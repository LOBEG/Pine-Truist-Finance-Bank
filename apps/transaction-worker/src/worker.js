/**
 * Transaction worker.
 *
 * INTERNAL LEDGER SIMULATION MODE
 * ================================
 * This worker advances ACH and wire rows through a state machine entirely
 * inside the Pine database. **No real ACH (NACHA) submission or Fedwire
 * transmission occurs.** It exists so that the rest of the platform can be
 * exercised end-to-end against a deterministic ledger.
 *
 * Before this service can be used to move real funds, this file must be
 * replaced with an adapter that talks to a regulated banking partner
 * (Modern Treasury / Dwolla / JPM Treasury Services for ACH; a Fedwire
 * sponsor bank for wires) and reconciles their webhooks back into the
 * outbox. That work is tracked in docs/PRODUCTION_READINESS.md and is a
 * hard go-live blocker.
 *
 * Concurrency: rows are claimed with `FOR UPDATE SKIP LOCKED` so this
 * service can run >1 replica without double-processing.
 */
import { loadConfig } from '@pine/lib-config';
import { createLogger } from '@pine/lib-logger';
import { createPool, query, withTransaction } from '@pine/lib-db';
import { createPublisher } from '@pine/lib-events';

const config = loadConfig({ serviceName: 'transaction-worker' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});
createPool({ url: config.database.url, ssl: config.database.ssl });
const publish = createPublisher(config.redis.url);

const POLL_INTERVAL_MS = 30_000;

async function advanceAchSubmissions() {
  // Claim a batch of initiated ACH transfers atomically. SKIP LOCKED lets
  // multiple worker replicas run safely without ever processing the same
  // row twice. We promote settlement_status to 'submitted' in the same
  // statement to make the claim+update atomic.
  const { rows } = await withTransaction(async (client) => {
    const r = await client.query(
      `WITH claimed AS (
         SELECT id FROM ach_transfers
          WHERE settlement_status = 'initiated'
          ORDER BY created_at
          LIMIT 25
          FOR UPDATE SKIP LOCKED
       )
       UPDATE ach_transfers a
          SET settlement_status = 'submitted', submitted_at = now(),
              trace_number = LPAD((1000000 + floor(random() * 8999999)::int)::text, 7, '0')
         FROM claimed
        WHERE a.id = claimed.id
        RETURNING a.id, a.transaction_id`,
    );
    return r;
  });
  for (const a of rows) {
    logger.info({ transactionId: a.transaction_id }, 'ACH submitted');
  }
}

async function advanceAchSettlements() {
  // Same SKIP LOCKED pattern: pick a batch of submitted rows whose dwell
  // time has elapsed, settle them inside a single transaction per row so
  // ledger promotion + transaction status + ach_transfers row all flip
  // atomically. A crash mid-loop leaves the in-flight row still 'submitted'
  // and it will be picked up on the next tick.
  const { rows } = await query(
    `WITH claimed AS (
       SELECT a.id FROM ach_transfers a
        WHERE a.settlement_status = 'submitted'
          AND a.submitted_at < now() - INTERVAL '1 minute'
        ORDER BY a.submitted_at
        LIMIT 25
        FOR UPDATE SKIP LOCKED
     )
     SELECT a.id, a.transaction_id, t.type
       FROM ach_transfers a
       JOIN claimed c ON c.id = a.id
       JOIN transactions t ON t.id = a.transaction_id`,
  );
  for (const a of rows) {
    await withTransaction(async (client) => {
      // Promote pending ledger entries to posted (release the hold and complete).
      await client.query(
        `UPDATE ledger_entries
            SET status = 'posted', posted_at = now()
          WHERE transaction_id = $1 AND status = 'pending'`,
        [a.transaction_id],
      );
      await client.query(
        `UPDATE transactions
            SET status = 'settled', posted_at = COALESCE(posted_at, now()), settled_at = now()
          WHERE id = $1`,
        [a.transaction_id],
      );
      await client.query(
        `UPDATE ach_transfers SET settlement_status = 'settled', settled_at = now() WHERE id = $1`,
        [a.id],
      );
    });
    await publish('transaction.posted', { transactionId: a.transaction_id, type: a.type });
    logger.info({ transactionId: a.transaction_id }, 'ACH settled');
  }
}

async function advanceWires() {
  const { rows } = await query(
    `WITH claimed AS (
       SELECT w.id FROM wire_transfers w
        JOIN transactions t ON t.id = w.transaction_id
        WHERE w.status = 'initiated' AND t.status = 'pending'
        LIMIT 25
        FOR UPDATE SKIP LOCKED
     )
     SELECT w.id, w.transaction_id
       FROM wire_transfers w JOIN claimed c ON c.id = w.id`,
  );
  for (const w of rows) {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE ledger_entries
            SET status = 'posted', posted_at = now()
          WHERE transaction_id = $1 AND status = 'pending'`,
        [w.transaction_id],
      );
      await client.query(
        `UPDATE transactions
            SET status = 'settled', posted_at = now(), settled_at = now()
          WHERE id = $1`,
        [w.transaction_id],
      );
      await client.query(
        `UPDATE wire_transfers
            SET status = 'settled', sent_at = now(), settled_at = now(),
                imad = 'IMAD' || to_char(now(), 'YYYYMMDDHH24MISS'),
                omad = 'OMAD' || to_char(now(), 'YYYYMMDDHH24MISS')
          WHERE id = $1`,
        [w.id],
      );
    });
    await publish('transaction.posted', { transactionId: w.transaction_id, type: 'wire_domestic' });
    logger.info({ transactionId: w.transaction_id }, 'wire settled');
  }
}

async function tick() {
  try {
    await advanceAchSubmissions();
    await advanceAchSettlements();
    await advanceWires();
  } catch (err) {
    logger.error({ err: err.message }, 'transaction-worker tick error');
  }
}

setInterval(tick, POLL_INTERVAL_MS);
tick();
logger.info({ intervalMs: POLL_INTERVAL_MS }, 'transaction-worker started');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
