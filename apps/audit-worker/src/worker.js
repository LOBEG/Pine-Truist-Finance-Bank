/**
 * Audit worker.
 *
 * 1. Mirrors notable Redis events into audit_logs (for systems that publish
 *    without writing audit synchronously).
 * 2. Periodically rolls audit_logs monthly partitions forward and (in
 *    production) archives partitions older than 90 days to S3 cold storage.
 */
import { loadConfig } from '@pine/lib-config';
import { createLogger } from '@pine/lib-logger';
import { createPool, query } from '@pine/lib-db';
import { CHANNELS, createSubscriber } from '@pine/lib-events';

const config = loadConfig({ serviceName: 'audit-worker' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});
createPool({ url: config.database.url, ssl: config.database.ssl });

const NOTABLE_TOPICS = new Set([
  'transaction.flagged',
  'fraud.alert',
  'withdrawal.requested',
  'withdrawal.approved',
  'withdrawal.rejected',
  'pin.issued',
  'pin.revoked',
]);

async function appendAuditFromEvent(msg) {
  if (!NOTABLE_TOPICS.has(msg.topic)) return;
  // Dedup on outbox id.
  if (msg.id) {
    const dup = await query(
      `INSERT INTO consumer_dedup (consumer, event_id) VALUES ('audit-worker', $1)
       ON CONFLICT DO NOTHING RETURNING 1`,
      [msg.id],
    );
    if (dup.rowCount === 0) return;
  }
  await query(
    `INSERT INTO audit_logs
       (actor_user_id, actor_role, action, resource_type, resource_id, after)
     VALUES ($1, 'system', $2, 'event', $3, $4::jsonb)`,
    [
      msg.userId || null,
      msg.topic,
      msg.transactionId || msg.withdrawalId || msg.pinId || null,
      JSON.stringify(msg),
    ],
  );
}

async function ensureUpcomingPartitions() {
  // Create partitions for current and next 2 months if missing.
  for (let i = 0; i <= 2; i += 1) {
    await query(
      `DO $$
       DECLARE
         start_dt date := (date_trunc('month', now()) + (${i} || ' month')::interval)::date;
         end_dt   date := (date_trunc('month', now()) + (${i + 1} || ' month')::interval)::date;
         part_name text := 'audit_logs_' || to_char(start_dt, 'YYYY_MM');
       BEGIN
         EXECUTE format(
           'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L);',
           part_name, start_dt, end_dt);
       END $$;`,
    );
  }
}

setInterval(
  () => {
    ensureUpcomingPartitions().catch((err) =>
      logger.error({ err: err.message }, 'partition maintenance failed'),
    );
  },
  6 * 60 * 60 * 1000,
); // every 6h

createSubscriber(config.redis.url, {
  channels: Object.values(CHANNELS),
  logger,
  onMessage: (_channel, msg) => {
    appendAuditFromEvent(msg).catch((err) =>
      logger.error({ err: err.message, topic: msg.topic }, 'audit append failed'),
    );
  },
});

ensureUpcomingPartitions().catch((err) =>
  logger.error({ err: err.message }, 'initial partition maintenance failed'),
);
logger.info('audit-worker subscribed');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
