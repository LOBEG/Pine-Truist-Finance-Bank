/**
 * Transaction worker.
 *
 * EXTERNAL RAILS DISABLED BY DEFAULT
 * ===================================
 * This worker processes ACH and wire transactions ONLY when external rails
 * are explicitly enabled in the external_rails_config table. By default,
 * external ACH/wire transfers are REJECTED at the API layer (transfers.js).
 *
 * Any transactions that somehow reach this worker while external rails are
 * disabled will be failed with 'external_rails_disabled' status. This is a
 * safety measure to prevent accidental money movement.
 *
 * REAL MONEY MOVEMENT REQUIRES:
 * 1. A regulated banking partner integration (Modern Treasury / Dwolla / JPM)
 * 2. The external_rails_config table updated with enabled=true for the provider
 * 3. Replacement of the simulation logic with real provider adapters
 *
 * See docs/PRODUCTION_READINESS.md for go-live checklist.
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

// Use Postgres LISTEN/NOTIFY for pub/sub (no Redis)
const publish = createPublisher(config.database.url);

const POLL_INTERVAL_MS = 30_000;

/**
 * Check if external rails are enabled. Returns false if disabled.
 * When disabled, transactions should NOT be processed.
 */
async function isExternalRailsEnabled(provider) {
  const { rows } = await query(`SELECT enabled FROM external_rails_config WHERE provider = $1`, [
    provider,
  ]);
  return rows[0]?.enabled === true;
}

/**
 * Fail transactions that were created when rails were disabled.
 * This is a safety net — the API should reject these, but if any
 * slip through (e.g., during a race condition), fail them here.
 */
async function failDisabledTransactions(provider, tableName) {
  const { rows } = await query(
    `WITH claimed AS (
       SELECT t.id FROM ${tableName} a
       JOIN transactions t ON t.id = a.transaction_id
       WHERE a.settlement_status = 'initiated' OR a.status = 'initiated'
       LIMIT 10
       FOR UPDATE SKIP LOCKED
     )
     SELECT t.id, t.type FROM transactions t
     JOIN claimed c ON c.id = t.id`,
  );

  for (const t of rows) {
    await withTransaction(async (client) => {
      // Reverse ledger entries
      await client.query(
        `UPDATE ledger_entries
         SET status = 'reversed', reversed_at = now()
         WHERE transaction_id = $1 AND status IN ('pending', 'posted')`,
        [t.id],
      );
      // Fail the transaction
      await client.query(
        `UPDATE transactions
         SET status = 'failed', failed_reason = 'external_rails_disabled'
         WHERE id = $1`,
        [t.id],
      );
      // Update provider-specific table
      if (tableName === 'ach_transfers') {
        await client.query(
          `UPDATE ach_transfers
           SET settlement_status = 'failed', return_reason_code = 'R99'
           WHERE transaction_id = $1`,
          [t.id],
        );
      } else {
        await client.query(
          `UPDATE wire_transfers SET status = 'failed' WHERE transaction_id = $1`,
          [t.id],
        );
      }
    });
    await publish('transaction.failed', {
      transactionId: t.id,
      type: t.type,
      reason: 'external_rails_disabled',
    });
    logger.warn(
      { transactionId: t.id, provider },
      `Transaction failed: external ${provider.toUpperCase()} rails disabled`,
    );
  }
  return rows.length;
}

async function advanceAchSubmissions() {
  // Check if ACH rails are enabled
  if (!(await isExternalRailsEnabled('ach'))) {
    const failed = await failDisabledTransactions('ach', 'ach_transfers');
    if (failed > 0) {
      logger.warn({ count: failed }, 'Failed ACH transactions — external rails disabled');
    }
    return;
  }

  // NOTE: This is SIMULATION MODE. Real ACH requires a banking partner.
  // This code should be replaced with actual NACHA file generation and
  // submission to a processor like Modern Treasury or Dwolla.

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
    logger.info({ transactionId: a.transaction_id }, 'ACH submitted (SIMULATION)');
  }
}

async function advanceAchSettlements() {
  if (!(await isExternalRailsEnabled('ach'))) {
    return; // Rails disabled — don't settle
  }

  // NOTE: Real ACH settlement comes from webhook callbacks from the processor.
  // This simulation auto-settles after a short delay.

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
    logger.info({ transactionId: a.transaction_id }, 'ACH settled (SIMULATION)');
  }
}

async function advanceWires() {
  // Check if wire rails are enabled
  if (!(await isExternalRailsEnabled('wire'))) {
    const failed = await failDisabledTransactions('wire', 'wire_transfers');
    if (failed > 0) {
      logger.warn({ count: failed }, 'Failed wire transactions — external rails disabled');
    }
    return;
  }

  // NOTE: Real wire processing requires Fedwire sponsor bank integration.
  // This simulation auto-settles immediately.

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
    logger.info({ transactionId: w.transaction_id }, 'wire settled (SIMULATION)');
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
