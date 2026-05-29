import { loadConfig } from '@pine/lib-config';
import { createLogger } from '@pine/lib-logger';
import { createPool, query } from '@pine/lib-db';
import { CHANNELS, createSubscriber, createPublisher } from '@pine/lib-events';
import { RULES } from './rules.js';

const config = loadConfig({ serviceName: 'fraud-engine' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});
createPool({ url: config.database.url, ssl: config.database.ssl });

// Use Postgres LISTEN/NOTIFY for pub/sub (no Redis)
const publish = createPublisher(config.database.url);

const FLAG_THRESHOLD = 50;

async function scoreTransaction(msg) {
  if (!msg.transactionId) return;
  const { rows } = await query(
    `SELECT initiated_by_user_id, amount::text AS amount, status
       FROM transactions WHERE id = $1`,
    [msg.transactionId],
  );
  const t = rows[0];
  if (!t) return;

  let total = 0;
  const hits = [];
  const ctx = {
    transactionId: msg.transactionId,
    userId: t.initiated_by_user_id,
    amount: t.amount,
  };
  for (const rule of RULES) {
    const r = await rule(ctx).catch(() => null);
    if (r) {
      total += r.score;
      hits.push(r);
    }
  }

  await query(`UPDATE transactions SET fraud_score = $2 WHERE id = $1`, [msg.transactionId, total]);

  if (total >= FLAG_THRESHOLD) {
    for (const h of hits) {
      await query(
        `INSERT INTO fraud_alerts (user_id, transaction_id, rule, score, severity, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          t.initiated_by_user_id,
          msg.transactionId,
          h.detail.rule,
          h.score,
          h.severity,
          JSON.stringify(h.detail),
        ],
      );
    }
    if (t.status === 'posted' || t.status === 'pending') {
      await query(
        `UPDATE transactions SET status = 'pending_review' WHERE id = $1 AND status IN ('posted','pending')`,
        [msg.transactionId],
      );
    }
    await publish('fraud.alert', {
      userId: t.initiated_by_user_id,
      transactionId: msg.transactionId,
      score: total,
      rules: hits.map((h) => h.detail.rule),
    });
    logger.warn({ transactionId: msg.transactionId, score: total }, 'transaction flagged');
  } else {
    logger.debug({ transactionId: msg.transactionId, score: total }, 'transaction cleared');
  }
}

// Use Postgres LISTEN/NOTIFY for pub/sub (no Redis)
createSubscriber(config.database.url, {
  channels: [CHANNELS.TRANSACTIONS],
  logger,
  onMessage: (_channel, msg) => {
    if (msg.topic === 'transaction.created' || msg.topic === 'transaction.posted') {
      scoreTransaction(msg).catch((err) =>
        logger.error({ err: err.message }, 'fraud scoring failed'),
      );
    }
  },
});

logger.info('fraud-engine subscribed');
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
