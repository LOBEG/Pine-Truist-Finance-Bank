import IORedis from 'ioredis';

/**
 * Canonical Redis pub/sub channels.
 */
export const CHANNELS = Object.freeze({
  TRANSACTIONS: 'pine.events.transactions',
  WITHDRAWALS: 'pine.events.withdrawals',
  PINS: 'pine.events.pins',
  FRAUD: 'pine.events.fraud',
  COMPLIANCE: 'pine.events.compliance',
  AUTH: 'pine.events.auth',
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
  return 'pine.events.misc';
}

export function createPublisher(redisUrl) {
  const pub = new IORedis(redisUrl);
  return async function publish(topic, payload) {
    const channel = topicToChannel(topic);
    const envelope = JSON.stringify({ topic, ts: new Date().toISOString(), ...payload });
    await pub.publish(channel, envelope);
  };
}

export function createSubscriber(redisUrl, { channels, onMessage, logger }) {
  const sub = new IORedis(redisUrl);
  sub.subscribe(...channels, (err, count) => {
    if (err) logger?.error({ err }, 'subscribe failed');
    else logger?.info({ count, channels }, 'subscribed');
  });
  sub.on('message', (channel, message) => {
    try {
      onMessage(channel, JSON.parse(message));
    } catch (err) {
      logger?.error({ err, channel }, 'invalid event payload');
    }
  });
  return sub;
}
