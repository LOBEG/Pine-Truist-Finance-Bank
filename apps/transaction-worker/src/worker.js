/**
 * Transaction worker.
 *
 * Polls pending ACH and wire transactions and advances them through their
 * state machine. In production, ACH submission goes to a NACHA partner API
 * (e.g., Modern Treasury, Dwolla, JPM Treasury Services); wires go to Fedwire
 * via a partner bank. This worker simulates the state machine for the demo
 * environment: pending → submitted → settled (T+1 simulated as immediate).
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
  const { rows } = await query(
    `SELECT a.id, a.transaction_id, a.settlement_status
       FROM ach_transfers a
      WHERE a.settlement_status = 'initiated'
      ORDER BY a.created_at LIMIT 25`,
  );
  for (const a of rows) {
    await query(
      `UPDATE ach_transfers
          SET settlement_status = 'submitted', submitted_at = now(),
              trace_number = LPAD((1000000 + floor(random() * 8999999)::int)::text, 7, '0')
        WHERE id = $1`,
      [a.id],
    );
    logger.info({ transactionId: a.transaction_id }, 'ACH submitted');
  }
}

async function advanceAchSettlements() {
  const { rows } = await query(
    `SELECT a.id, a.transaction_id, t.source_account_id, t.amount::text AS amount, t.type
       FROM ach_transfers a
       JOIN transactions t ON t.id = a.transaction_id
      WHERE a.settlement_status = 'submitted'
        AND a.submitted_at < now() - INTERVAL '1 minute'
      ORDER BY a.submitted_at LIMIT 25`,
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
    `SELECT w.id, w.transaction_id, w.status, t.amount::text AS amount
       FROM wire_transfers w JOIN transactions t ON t.id = w.transaction_id
      WHERE w.status = 'initiated' AND t.status = 'pending'
      LIMIT 25`,
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
