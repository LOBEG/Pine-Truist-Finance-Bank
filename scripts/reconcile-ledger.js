#!/usr/bin/env node
/**
 * Ledger reconciliation report.
 *
 * Verifies:
 *   1. Sum of posted credits == sum of posted debits across ALL accounts
 *      (system-wide double-entry invariant).
 *   2. Per-transaction sum of posted entries == 0.
 *   3. Per-account ledger balance matches the canonical SQL function.
 *
 * Exit code 0 on green, non-zero on drift. Designed for cron / CI.
 */
import { createPool, query, shutdown } from '@pine/lib-db';

async function main() {
  createPool({ url: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL || 'require' });

  let problems = 0;

  // Global ledger sum.
  const g = await query(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END), 0)::text AS net
       FROM ledger_entries WHERE status = 'posted'`,
  );
  if (Number(g.rows[0].net) !== 0) {
    problems += 1;
    console.error(`✗ Global ledger drift: net=${g.rows[0].net}`);
  } else {
    console.info('✓ Global posted ledger balanced (sum=0)');
  }

  // Per-transaction imbalance check.
  const t = await query(
    `SELECT transaction_id,
            SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END) AS net
       FROM ledger_entries WHERE status = 'posted'
      GROUP BY transaction_id HAVING SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END) <> 0`,
  );
  if (t.rowCount === 0) {
    console.info('✓ Every transaction sums to 0');
  } else {
    problems += t.rowCount;
    console.error(`✗ ${t.rowCount} transactions are unbalanced`);
    for (const r of t.rows.slice(0, 10)) {
      console.error(`  ${r.transaction_id}  net=${r.net}`);
    }
  }

  // Per-account drift vs. SQL function (sanity).
  const a = await query(
    `SELECT a.id, account_ledger_balance(a.id)::text AS fn_bal,
            (SELECT COALESCE(SUM(CASE WHEN direction='credit' AND status='posted' THEN amount
                                       WHEN direction='debit'  AND status='posted' THEN -amount
                                       ELSE 0 END), 0)
               FROM ledger_entries WHERE account_id = a.id)::text AS scan_bal
       FROM accounts a`,
  );
  let drift = 0;
  for (const r of a.rows) {
    if (Number(r.fn_bal) !== Number(r.scan_bal)) drift += 1;
  }
  if (drift === 0) console.info(`✓ All ${a.rowCount} accounts reconcile with SQL function`);
  else {
    problems += drift;
    console.error(`✗ ${drift} accounts drift vs. SQL function`);
  }

  await shutdown();
  if (problems > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
