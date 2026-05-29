/**
 * Notification worker.
 *
 * NOTIFICATION DELIVERY MODES
 * ===========================
 * This worker supports multiple delivery modes based on configuration:
 *
 * 1. LOG-ONLY MODE (default): Notifications are logged and stored in the
 *    database but not delivered externally. This is safe for development.
 *
 * 2. POSTMARK MODE: For email notifications. Requires POSTMARK_API_KEY.
 *
 * 3. TWILIO MODE: For SMS notifications. Requires TWILIO_* config.
 *
 * Failed deliveries are tracked in notification_deliveries with retry logic.
 * After max retries, notifications are moved to notification_dlq.
 */
import { loadConfig } from '@pine/lib-config';
import { createLogger } from '@pine/lib-logger';
import { createPool, query } from '@pine/lib-db';
import { CHANNELS, createSubscriber } from '@pine/lib-events';
import { renderTemplate } from './templates.js';

const config = loadConfig({ serviceName: 'notification-worker' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});

createPool({ url: config.database.url, ssl: config.database.ssl });

// Notification providers (initialized lazily)
let _postmarkClient = null;
let _twilioClient = null;

async function getPostmarkClient() {
  if (_postmarkClient !== undefined) return _postmarkClient;

  const apiKey = process.env.POSTMARK_API_KEY;
  if (!apiKey) {
    logger.warn('POSTMARK_API_KEY not set — email delivery disabled');
    _postmarkClient = null;
    return null;
  }

  try {
    const { ServerClient } = await import('@postmarkapp/postmark');
    _postmarkClient = new ServerClient(apiKey);
    logger.info('Postmark client initialized');
    return _postmarkClient;
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to initialize Postmark client');
    _postmarkClient = null;
    return null;
  }
}

async function getTwilioClient() {
  if (_twilioClient !== undefined) return _twilioClient;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    logger.warn('TWILIO_* config incomplete — SMS delivery disabled');
    _twilioClient = null;
    return null;
  }

  try {
    const twilio = await import('twilio');
    _twilioClient = {
      client: twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
      fromNumber: TWILIO_FROM_NUMBER,
    };
    logger.info('Twilio client initialized');
    return _twilioClient;
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to initialize Twilio client');
    _twilioClient = null;
    return null;
  }
}

const TOPIC_TO_TEMPLATE = {
  'transaction.posted': 'transaction.posted',
  'transaction.flagged': 'transaction.flagged',
  'transaction.failed': 'transaction.failed',
  'withdrawal.requested': 'withdrawal.requested',
  'withdrawal.approved': 'withdrawal.approved',
  'withdrawal.rejected': 'withdrawal.rejected',
  'pin.issued': 'pin.issued',
  'auth.login.succeeded': 'auth.login.succeeded',
};

const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * Deliver notification via email using Postmark.
 */
async function deliverEmail(notification, recipient, body) {
  const postmark = await getPostmarkClient();

  if (!postmark) {
    // Log-only mode: record as delivered via log provider
    return { provider: 'log', providerId: null, status: 'delivered' };
  }

  try {
    const response = await postmark.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@pinebank.com',
      To: recipient.email,
      Subject: body.subject || 'Notification from Pine Bank',
      HtmlBody: body.html || body.text,
      TextBody: body.text,
      MessageStream: 'outbound',
    });
    return { provider: 'postmark', providerId: response.MessageID, status: 'sent' };
  } catch (err) {
    logger.error({ err: err.message, notificationId: notification.id }, 'Postmark delivery failed');
    throw err;
  }
}

/**
 * Deliver notification via SMS using Twilio.
 */
async function deliverSms(notification, recipient, body) {
  const twilio = await getTwilioClient();

  if (!twilio) {
    return { provider: 'log', providerId: null, status: 'delivered' };
  }

  try {
    const message = await twilio.client.messages.create({
      body: body.text,
      from: twilio.fromNumber,
      to: recipient.phone,
    });
    return { provider: 'twilio', providerId: message.sid, status: 'sent' };
  } catch (err) {
    logger.error({ err: err.message, notificationId: notification.id }, 'Twilio delivery failed');
    throw err;
  }
}

/**
 * Create a delivery record and attempt delivery.
 */
async function attemptDelivery(notificationId, channel, recipient, body) {
  // Create delivery record
  const { rows } = await query(
    `INSERT INTO notification_deliveries
       (notification_id, provider, status, attempts)
     VALUES ($1, $2, 'pending', 1)
     RETURNING id`,
    [notificationId, channel === 'sms' ? 'twilio' : 'postmark'],
  );
  const deliveryId = rows[0].id;

  try {
    let result;
    if (channel === 'sms') {
      result = await deliverSms({ id: notificationId }, recipient, body);
    } else {
      result = await deliverEmail({ id: notificationId }, recipient, body);
    }

    // Update delivery record with success
    await query(
      `UPDATE notification_deliveries
       SET provider = $1, provider_id = $2, status = $3, sent_at = now()
       WHERE id = $4`,
      [result.provider, result.providerId, result.status, deliveryId],
    );

    return true;
  } catch (err) {
    // Update delivery record with failure
    await query(
      `UPDATE notification_deliveries
       SET status = 'failed', last_error = $1
       WHERE id = $2`,
      [err.message, deliveryId],
    );

    return false;
  }
}

async function handle(channel, msg) {
  const template = TOPIC_TO_TEMPLATE[msg.topic];
  if (!template || !msg.userId) return;

  // Idempotency on event id (outbox id).
  if (msg.id) {
    const dup = await query(
      `INSERT INTO consumer_dedup (consumer, event_id)
       VALUES ('notification-worker', $1)
       ON CONFLICT DO NOTHING RETURNING 1`,
      [msg.id],
    );
    if (dup.rowCount === 0) return;
  }

  // Get user's notification preferences and contact info
  const { rows: userRows } = await query(
    `SELECT u.email, u.phone, np.channel
     FROM users u
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE u.id = $1`,
    [msg.userId],
  );

  if (!userRows[0]) {
    logger.warn({ userId: msg.userId }, 'User not found for notification');
    return;
  }

  const user = userRows[0];
  const notificationChannel = user.channel || 'email'; // Default to email

  // Render the notification body
  const body = renderTemplate(template, msg);

  // Create notification record
  const { rows: notifRows } = await query(
    `INSERT INTO notifications (user_id, channel, template, payload, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [msg.userId, notificationChannel, template, JSON.stringify({ body, source: msg })],
  );
  const notificationId = notifRows[0].id;

  // Attempt delivery
  const success = await attemptDelivery(
    notificationId,
    notificationChannel,
    { email: user.email, phone: user.phone },
    body,
  );

  // Update notification status
  await query(
    `UPDATE notifications SET status = $1, sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE sent_at END
     WHERE id = $2`,
    [success ? 'sent' : 'pending', notificationId],
  );

  logger.info(
    { topic: msg.topic, userId: msg.userId, success, provider: notificationChannel },
    'notification processed',
  );
}

/**
 * Retry failed notifications (run periodically).
 */
async function retryFailedNotifications() {
  const { rows } = await query(
    `SELECT DISTINCT nd.notification_id, n.user_id, n.channel, n.template, n.payload
     FROM notification_deliveries nd
     JOIN notifications n ON n.id = nd.notification_id
     WHERE nd.status = 'failed'
       AND nd.attempts < $1
       AND nd.created_at > now() - INTERVAL '24 hours'
     LIMIT 10`,
    [MAX_DELIVERY_ATTEMPTS],
  );

  for (const row of rows) {
    try {
      const { rows: userRows } = await query(`SELECT email, phone FROM users WHERE id = $1`, [
        row.user_id,
      ]);

      if (!userRows[0]) continue;

      const payload = JSON.parse(row.payload);
      const success = await attemptDelivery(
        row.notification_id,
        row.channel,
        { email: userRows[0].email, phone: userRows[0].phone },
        payload.body,
      );

      if (success) {
        await query(`UPDATE notifications SET status = 'sent', sent_at = now() WHERE id = $1`, [
          row.notification_id,
        ]);
        logger.info({ notificationId: row.notification_id }, 'notification retry succeeded');
      }
    } catch (err) {
      logger.error(
        { err: err.message, notificationId: row.notification_id },
        'notification retry failed',
      );
    }
  }

  // Move exhausted retries to DLQ
  await query(
    `INSERT INTO notification_dlq (notification_id, reason, payload)
     SELECT nd.notification_id, 'max_retries_exceeded', n.payload::jsonb
     FROM notification_deliveries nd
     JOIN notifications n ON n.id = nd.notification_id
     WHERE nd.status = 'failed'
       AND nd.attempts >= $1
       AND nd.notification_id NOT IN (SELECT notification_id FROM notification_dlq)`,
    [MAX_DELIVERY_ATTEMPTS],
  );
}

// Use Postgres LISTEN/NOTIFY for pub/sub (no Redis)
createSubscriber(config.database.url, {
  channels: Object.values(CHANNELS),
  logger,
  onMessage: (channel, msg) => {
    handle(channel, msg).catch((err) =>
      logger.error({ err, topic: msg.topic }, 'notification handler failed'),
    );
  },
});

// Retry failed notifications every 5 minutes
setInterval(
  () => {
    retryFailedNotifications().catch((err) =>
      logger.error({ err: err.message }, 'retry failed notifications error'),
    );
  },
  5 * 60 * 1000,
);

logger.info('notification-worker subscribed');

// Keep process alive.
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
