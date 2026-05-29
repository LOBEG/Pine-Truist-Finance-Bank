/**
 * Scheduler — node-cron driven jobs.
 *
 * Jobs:
 *   - 3pm ET weekday: ACH cutoff submission (handled by transaction-worker)
 *   - nightly 02:00 ET: interest accrual on savings/money_market
 *   - 1st of month 03:00: monthly statement generation
 *   - daily 04:00: session reaper (expire+delete old revoked sessions)
 *   - daily 04:15: refresh-token cleanup
 *   - daily 04:30: audit archival (>90d to cold storage in prod)
 *   - hourly: ledger reconciliation drift check
 *   - hourly: outbox health check
 *   - hourly: rate limit entry cleanup
 *
 * Times are expressed in cron format; production deployment should set TZ
 * environment variable to America/New_York for ET-anchored business windows.
 */
import cron from 'node-cron';
import { loadConfig } from '@pine/lib-config';
import { createLogger } from '@pine/lib-logger';
import { createPool, query } from '@pine/lib-db';
import { createPublisher } from '@pine/lib-events';

const config = loadConfig({ serviceName: 'scheduler' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});
createPool({ url: config.database.url, ssl: config.database.ssl });

// Use Postgres LISTEN/NOTIFY for pub/sub (no Redis)
const publish = createPublisher(config.database.url);

// -------- Jobs --------

async function interestAccrual() {
  // Accrue 0.0066%/day on savings, 0.0099%/day on money_market (~ 2.4%/3.6% APY).
  const accts = await query(
    `SELECT id, user_id, account_type, account_ledger_balance(id)::text AS bal
       FROM accounts
      WHERE status = 'active' AND account_type IN ('savings','money_market')`,
  );
  for (const a of accts.rows) {
    const rate = a.account_type === 'savings' ? 0.000066 : 0.000099;
    const interest = (Number(a.bal) * rate).toFixed(2);
    if (Number(interest) <= 0) continue;
    await query(`INSERT INTO outbox (topic, payload) VALUES ($1, $2::jsonb)`, [
      'interest.accrual.requested',
      JSON.stringify({ accountId: a.id, userId: a.user_id, amount: interest }),
    ]);
  }
  logger.info({ count: accts.rowCount }, 'interest accrual requests queued');
}

async function sessionReaper() {
  const r = await query(
    `DELETE FROM sessions
      WHERE (revoked_at IS NOT NULL AND revoked_at < now() - INTERVAL '30 days')
         OR (expires_at < now() - INTERVAL '7 days')`,
  );
  logger.info({ deleted: r.rowCount }, 'sessions reaped');
}

async function pinReaper() {
  const r = await query(
    `UPDATE transfer_pins SET status = 'expired'
       WHERE status = 'active' AND expires_at < now()`,
  );
  logger.info({ expired: r.rowCount }, 'expired PINs marked');
}

async function ledgerDriftCheck() {
  // For every transaction with posted entries, sum(debits) must equal sum(credits).
  const { rows } = await query(
    `SELECT transaction_id,
            SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END) AS net
       FROM ledger_entries
      WHERE status = 'posted'
      GROUP BY transaction_id
     HAVING SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END) <> 0`,
  );
  if (rows.length > 0) {
    logger.error({ violations: rows.length, sample: rows.slice(0, 5) }, 'LEDGER DRIFT DETECTED');
    await publish('ops.ledger.drift', { violations: rows.length });
  } else {
    logger.info('ledger reconciliation clean');
  }
}

async function outboxHealth() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS pending FROM outbox WHERE delivered_at IS NULL`,
  );
  if (rows[0].pending > 5000) {
    logger.error({ pending: rows[0].pending }, 'outbox backlog growing');
  }
}

async function rateLimitCleanup() {
  // Clean up expired rate limit entries (Postgres-native rate limiting)
  const r = await query(`SELECT cleanup_rate_limits() AS deleted`);
  if (r.rows[0].deleted > 0) {
    logger.info({ deleted: r.rows[0].deleted }, 'rate limit entries cleaned');
  }
}

async function monthlyStatements() {
  const accts = await query(`SELECT id FROM accounts WHERE status != 'closed'`);
  const periodEnd = new Date();
  periodEnd.setUTCDate(1);
  periodEnd.setUTCHours(0, 0, 0, 0);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
  for (const a of accts.rows) {
    const opening = await query(
      `SELECT COALESCE(SUM(CASE WHEN direction='credit' AND status='posted' THEN amount
                                WHEN direction='debit' AND status='posted' THEN -amount
                                ELSE 0 END), 0)::text AS bal
         FROM ledger_entries WHERE account_id = $1 AND posted_at < $2`,
      [a.id, periodStart.toISOString()],
    );
    const closing = await query(
      `SELECT COALESCE(SUM(CASE WHEN direction='credit' AND status='posted' THEN amount
                                WHEN direction='debit' AND status='posted' THEN -amount
                                ELSE 0 END), 0)::text AS bal
         FROM ledger_entries WHERE account_id = $1 AND posted_at < $2`,
      [a.id, periodEnd.toISOString()],
    );
    await query(
      `INSERT INTO statements (account_id, period_start, period_end, opening_balance, closing_balance)
       VALUES ($1, $2::date, $3::date, $4, $5)
       ON CONFLICT (account_id, period_start, period_end) DO NOTHING`,
      [
        a.id,
        periodStart.toISOString().slice(0, 10),
        periodEnd.toISOString().slice(0, 10),
        opening.rows[0].bal,
        closing.rows[0].bal,
      ],
    );
  }
  logger.info({ count: accts.rowCount }, 'monthly statements generated');
}

// -------- Schedules --------

cron.schedule('0 2 * * *', () =>
  interestAccrual().catch((e) => logger.error({ err: e.message }, 'interest')),
);
cron.schedule('0 4 * * *', () =>
  sessionReaper().catch((e) => logger.error({ err: e.message }, 'sessions')),
);
cron.schedule('15 4 * * *', () =>
  pinReaper().catch((e) => logger.error({ err: e.message }, 'pins')),
);
cron.schedule('0 * * * *', () =>
  ledgerDriftCheck().catch((e) => logger.error({ err: e.message }, 'ledger')),
);
cron.schedule('5 * * * *', () =>
  outboxHealth().catch((e) => logger.error({ err: e.message }, 'outbox')),
);
cron.schedule('10 * * * *', () =>
  rateLimitCleanup().catch((e) => logger.error({ err: e.message }, 'ratelimit')),
);
cron.schedule('0 3 1 * *', () =>
  monthlyStatements().catch((e) => logger.error({ err: e.message }, 'statements')),
);

logger.info('scheduler started');
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
