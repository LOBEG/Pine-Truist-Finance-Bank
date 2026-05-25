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

const TOPIC_TO_TEMPLATE = {
  'transaction.posted': 'transaction.posted',
  'transaction.flagged': 'transaction.flagged',
  'withdrawal.requested': 'withdrawal.requested',
  'withdrawal.approved': 'withdrawal.approved',
  'withdrawal.rejected': 'withdrawal.rejected',
  'pin.issued': 'pin.issued',
  'auth.login.succeeded': 'auth.login.succeeded',
};

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

  const body = renderTemplate(template, msg);
  // Log-only mode (no provider configured here).
  await query(
    `INSERT INTO notifications (user_id, channel, template, payload, status, sent_at)
     VALUES ($1, 'email', $2, $3, 'sent', now())`,
    [msg.userId, template, JSON.stringify({ body, source: msg })],
  );
  logger.info({ topic: msg.topic, userId: msg.userId }, 'notification dispatched');
}

createSubscriber(config.redis.url, {
  channels: Object.values(CHANNELS),
  logger,
  onMessage: (channel, msg) => {
    handle(channel, msg).catch((err) =>
      logger.error({ err, topic: msg.topic }, 'notification handler failed'),
    );
  },
});

logger.info('notification-worker subscribed');

// Keep process alive.
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
