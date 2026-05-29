/**
 * @pine/lib-events — Postgres LISTEN/NOTIFY pub/sub
 *
 * ARCHITECTURE CHANGE (v2.0):
 * This module replaces Redis pub/sub with Postgres LISTEN/NOTIFY.
 * This eliminates the Redis dependency and keeps all state in Postgres.
 *
 * Channels are mapped to Postgres notification channels.
 * Payload size limit is 8000 bytes; larger payloads use outbox pattern.
 */
import pg from 'pg';
import { getPool } from '@pine/lib-db';

const { Client } = pg;

/**
 * Canonical notification channels.
 */
export const CHANNELS = Object.freeze({
  TRANSACTIONS: 'pine_transactions',
  WITHDRAWALS: 'pine_withdrawals',
  PINS: 'pine_pins',
  FRAUD: 'pine_fraud',
  COMPLIANCE: 'pine_compliance',
  AUTH: 'pine_auth',
  BALANCE: 'balance_updated',
});

export const EVENTS = Object.freeze({
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_POSTED: 'transaction.posted',
  TRANSACTION_FAILED: 'transaction.failed',
  TRANSACTION_REVERSED: 'transaction.reversed',
  TRANSACTION_FLAGGED: 'transaction.flagged',

  WITHDRAWAL_REQUESTED: 'withdrawal.requested',
  WITHDRAWAL_APPROVED: 'withdrawal.approved',
  WITHDRAWAL_REJECTED: 'withdrawal.rejected',
  WITHDRAWAL_DISBURSED: 'withdrawal.disbursed',

  PIN_ISSUED: 'pin.issued',
  PIN_CONSUMED: 'pin.consumed',
  PIN_REVOKED: 'pin.revoked',
  PIN_EXPIRED: 'pin.expired',

  AUTH_LOGIN_SUCCEEDED: 'auth.login.succeeded',
  AUTH_LOGIN_FAILED: 'auth.login.failed',

  BALANCE_UPDATED: 'balance.updated',
  FRAUD_ALERT: 'fraud.alert',
});

export function topicToChannel(topic) {
  if (topic.startsWith('transaction.')) return CHANNELS.TRANSACTIONS;
  if (topic.startsWith('withdrawal.')) return CHANNELS.WITHDRAWALS;
  if (topic.startsWith('pin.')) return CHANNELS.PINS;
  if (topic.startsWith('fraud.')) return CHANNELS.FRAUD;
  if (topic.startsWith('auth.')) return CHANNELS.AUTH;
  if (topic.startsWith('compliance.')) return CHANNELS.COMPLIANCE;
  if (topic.startsWith('balance.')) return CHANNELS.BALANCE;
  return 'pine_misc';
}

/**
 * Create a publisher that sends events via pg_notify.
 * Uses the existing pool for connection efficiency.
 */
export function createPublisher(_databaseUrl) {
  return async function publish(topic, payload) {
    const channel = topicToChannel(topic);
    const envelope = JSON.stringify({
      topic,
      ts: new Date().toISOString(),
      ...payload,
    });

    // NOTIFY has 8000 byte payload limit; verify before sending
    if (Buffer.byteLength(envelope, 'utf8') > 7900) {
      // For large payloads, store in outbox and send reference
      throw new Error('Payload too large for NOTIFY; use outbox pattern');
    }

    const pool = getPool();
    await pool.query(`SELECT pg_notify($1, $2)`, [channel, envelope]);
  };
}

/**
 * Create a subscriber that listens to Postgres channels.
 * Returns a Client instance that stays connected for notifications.
 */
export async function createSubscriber(databaseUrl, { channels, onMessage, logger }) {
  // Create a dedicated client for LISTEN (can't use pooled connections)
  const client = new Client({ connectionString: databaseUrl });

  client.on('error', (err) => {
    logger?.error({ err }, 'subscriber client error');
  });

  client.on('notification', (msg) => {
    try {
      const payload = JSON.parse(msg.payload);
      onMessage(msg.channel, payload);
    } catch (err) {
      logger?.error({ err, channel: msg.channel }, 'invalid event payload');
    }
  });

  await client.connect();

  // Subscribe to all requested channels
  for (const channel of channels) {
    await client.query(`LISTEN ${channel}`);
  }

  logger?.info({ count: channels.length, channels }, 'subscribed to pg channels');

  // Return client so caller can manage lifecycle
  return {
    client,
    close: async () => {
      for (const channel of channels) {
        await client.query(`UNLISTEN ${channel}`).catch(() => {});
      }
      await client.end();
    },
  };
}

/**
 * Publish directly via a transaction client (for outbox pattern).
 */
export async function publishViaClient(client, topic, payload) {
  const channel = topicToChannel(topic);
  const envelope = JSON.stringify({
    topic,
    ts: new Date().toISOString(),
    ...payload,
  });

  if (Buffer.byteLength(envelope, 'utf8') > 7900) {
    throw new Error('Payload too large for NOTIFY');
  }

  await client.query(`SELECT pg_notify($1, $2)`, [channel, envelope]);
}
