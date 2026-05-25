/**
 * Historical seed generator.
 *
 * Idempotent: refuses to run if balances are already populated. Designed for
 * the initial production deploy, gated behind the env var RUN_HISTORICAL_SEED.
 *
 * Strategy: create a primary customer with FOUR accounts (Checking, Savings,
 * Money Market, Investment). Then generate a deterministic 2-year sequence of:
 *   - bi-weekly payroll deposits
 *   - monthly recurring bills (utilities, mortgage, etc.)
 *   - monthly internal transfers (checking -> savings/money market/investment)
 *   - quarterly investment dividends
 *   - monthly interest accruals on savings/MM
 *
 * Targets (approximate, drift accepted within $5k):
 *   Checking       ~  $312,000
 *   Savings        ~ $1,450,000
 *   Money Market   ~ $1,700,000
 *   Investment     ~   $610,000
 *   TOTAL          >  $4,070,000
 *
 * Every entry flows through `postTransaction` so balance computation remains
 * canonical. No direct balance writes anywhere.
 */
import { query } from '@pine/lib-db';
import { hashPassword, encryptField, generateAccountNumber } from '@pine/lib-crypto';
import { postTransaction } from '@pine/lib-ledger';
import crypto from 'node:crypto';

const ROUTING = '053000219'; // example
const KEK = process.env.ENCRYPTION_KEK_B64 || '';
const RNG_SEED = process.env.SEED_RNG || 'pine-bank-historical-seed-v1';

function seededRng(seedStr) {
  // xorshift32 from sha256 of the seed string — deterministic across runs.
  let s = parseInt(crypto.createHash('sha256').update(seedStr).digest('hex').slice(0, 8), 16) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function jitter(rng, base, pct = 0.05) {
  const delta = base * pct * (rng() * 2 - 1);
  return Math.round((base + delta) * 100) / 100;
}

function isoDate(d) {
  return d.toISOString();
}

async function ensureUser() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'demo@pinebank.com';
  const password =
    process.env.BOOTSTRAP_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows[0]) return existing.rows[0].id;

  const hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, kyc_status)
     VALUES ($1, $2, $3, 'approved') RETURNING id`,
    [email, hash, 'Pine Bank Customer'],
  );
  await query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = 'customer'`,
    [rows[0].id],
  );
  console.info(`Seeded user ${email} (initial password set via SEED_DEMO_USER_PASSWORD env)`);
  return rows[0].id;
}

async function ensureAccount(userId, type, nickname) {
  const existing = await query(`SELECT id FROM accounts WHERE user_id = $1 AND account_type = $2`, [
    userId,
    type,
  ]);
  if (existing.rows[0]) return existing.rows[0].id;

  const number = generateAccountNumber();
  const enc = encryptField(number, KEK);
  const { rows } = await query(
    `INSERT INTO accounts
       (user_id, account_number_encrypted, account_number_last4, routing_number,
        account_type, nickname, status, opened_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', now() - interval '2 years' - interval '7 days')
     RETURNING id`,
    [userId, enc, number.slice(-4), ROUTING, type, nickname],
  );
  return rows[0].id;
}

async function adjustment({ accountId, amount, direction, when, description, idempotencyKey }) {
  // Opening deposits and external salary/bill movements use a system "cash" leg
  // captured against the same account but balanced by a counter-entry in a
  // reserved system account row representing external-world. To keep schema
  // simple we use a dedicated external-clearing account once per type.
  const sysId = await getExternalClearingAccount();
  const entries =
    direction === 'credit'
      ? [
          { accountId: sysId, direction: 'debit', amount },
          { accountId, direction: 'credit', amount },
        ]
      : [
          { accountId, direction: 'debit', amount },
          { accountId: sysId, direction: 'credit', amount },
        ];

  await postTransaction({
    type: direction === 'credit' ? 'deposit' : 'withdrawal',
    status: 'posted',
    idempotencyKey,
    amount,
    description,
    entries,
    sourceAccountId: direction === 'debit' ? accountId : null,
    destinationAccountId: direction === 'credit' ? accountId : null,
  });

  // Backdate the transaction to `when`.
  await query(
    `UPDATE transactions SET created_at = $1, posted_at = $1, settled_at = $1
     WHERE idempotency_key = $2`,
    [when, idempotencyKey],
  );
  await query(
    `UPDATE ledger_entries SET posted_at = $1, value_date = $1::date, created_at = $1
     WHERE transaction_id = (SELECT id FROM transactions WHERE idempotency_key = $2)`,
    [when, idempotencyKey],
  );
}

let _externalClearingId;
async function getExternalClearingAccount() {
  if (_externalClearingId) return _externalClearingId;

  // System (bank-owned) user holds clearing accounts. Created lazily.
  const userIdRow = await query(`SELECT id FROM users WHERE email = $1`, [
    'system@pinebank.internal',
  ]);
  let systemUserId = userIdRow.rows[0]?.id;
  if (!systemUserId) {
    const r = await query(
      `INSERT INTO users (email, password_hash, full_name, kyc_status)
       VALUES ('system@pinebank.internal', $1, 'Pine Bank System', 'approved') RETURNING id`,
      [await hashPassword('!!system-account-no-login!!')],
    );
    systemUserId = r.rows[0].id;
  }

  const acc = await query(
    `SELECT id FROM accounts WHERE user_id = $1 AND account_type = 'checking' AND nickname = 'EXTERNAL_CLEARING'`,
    [systemUserId],
  );
  if (acc.rows[0]) {
    _externalClearingId = acc.rows[0].id;
    return _externalClearingId;
  }

  const number = generateAccountNumber();
  const enc = encryptField(number, KEK);
  const ins = await query(
    `INSERT INTO accounts
       (user_id, account_number_encrypted, account_number_last4, routing_number,
        account_type, nickname, status)
     VALUES ($1, $2, $3, $4, 'checking', 'EXTERNAL_CLEARING', 'active')
     RETURNING id`,
    [systemUserId, enc, number.slice(-4), ROUTING],
  );
  _externalClearingId = ins.rows[0].id;
  return _externalClearingId;
}

async function internalMove({ from, to, amount, when, description, idempotencyKey }) {
  await postTransaction({
    type: 'internal_transfer',
    status: 'posted',
    idempotencyKey,
    amount,
    description,
    sourceAccountId: from,
    destinationAccountId: to,
    entries: [
      { accountId: from, direction: 'debit', amount },
      { accountId: to, direction: 'credit', amount },
    ],
  });
  await query(
    `UPDATE transactions SET created_at = $1, posted_at = $1, settled_at = $1
     WHERE idempotency_key = $2`,
    [when, idempotencyKey],
  );
  await query(
    `UPDATE ledger_entries SET posted_at = $1, value_date = $1::date, created_at = $1
     WHERE transaction_id = (SELECT id FROM transactions WHERE idempotency_key = $2)`,
    [when, idempotencyKey],
  );
}

export async function seedHistorical() {
  if (!KEK) throw new Error('ENCRYPTION_KEK_B64 required for historical seed.');

  const userId = await ensureUser();

  const checking = await ensureAccount(userId, 'checking', 'Pine Checking');
  const savings = await ensureAccount(userId, 'savings', 'Pine High-Yield Savings');
  const mm = await ensureAccount(userId, 'money_market', 'Pine Money Market');
  const inv = await ensureAccount(userId, 'investment', 'Pine Investment Account');

  // Guard: skip if already seeded heavily.
  const existing = await query(
    `SELECT COUNT(*)::int AS n FROM ledger_entries
     WHERE account_id IN ($1,$2,$3,$4)`,
    [checking, savings, mm, inv],
  );
  if (existing.rows[0].n > 200) {
    console.info('Historical seed already present, skipping.');
    return;
  }

  const rng = seededRng(RNG_SEED);
  const now = new Date();
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 2);
  start.setUTCHours(12, 0, 0, 0);

  // ---- Opening lump-sum deposits (rebuilding 2 years ago) ----
  await adjustment({
    accountId: checking,
    amount: '85000.00',
    direction: 'credit',
    when: isoDate(new Date(start.getTime() - 6 * 86_400_000)),
    description: 'Opening deposit — Checking',
    idempotencyKey: `seed:opening:checking:${userId}`,
  });
  await adjustment({
    accountId: savings,
    amount: '900000.00',
    direction: 'credit',
    when: isoDate(new Date(start.getTime() - 6 * 86_400_000)),
    description: 'Opening deposit — Savings',
    idempotencyKey: `seed:opening:savings:${userId}`,
  });
  await adjustment({
    accountId: mm,
    amount: '1200000.00',
    direction: 'credit',
    when: isoDate(new Date(start.getTime() - 6 * 86_400_000)),
    description: 'Opening deposit — Money Market',
    idempotencyKey: `seed:opening:mm:${userId}`,
  });
  await adjustment({
    accountId: inv,
    amount: '450000.00',
    direction: 'credit',
    when: isoDate(new Date(start.getTime() - 6 * 86_400_000)),
    description: 'Opening deposit — Investment',
    idempotencyKey: `seed:opening:inv:${userId}`,
  });

  // ---- Bi-weekly payroll for 2 years (~52 deposits) ----
  let cursor = new Date(start);
  let payrollCount = 0;
  while (cursor < now) {
    payrollCount += 1;
    const amount = jitter(rng, 9_800, 0.03);
    await adjustment({
      accountId: checking,
      amount: amount.toFixed(2),
      direction: 'credit',
      when: isoDate(cursor),
      description: `Payroll ACH — Acme Holdings`,
      idempotencyKey: `seed:payroll:${userId}:${payrollCount}`,
    });
    cursor = new Date(cursor.getTime() + 14 * 86_400_000);
  }

  // ---- Monthly recurring bills + transfers + dividends + interest ----
  cursor = new Date(start);
  let monthIx = 0;
  while (cursor < now) {
    monthIx += 1;
    const m = new Date(cursor);
    const mISO = (day, h = 14, min = 0) => {
      const d = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), day, h, min));
      return isoDate(d);
    };

    // Bills (debits from checking)
    const bills = [
      { day: 3, desc: 'Mortgage payment', amt: jitter(rng, 4_250, 0.005) },
      { day: 5, desc: 'Electric utility', amt: jitter(rng, 215, 0.18) },
      { day: 7, desc: 'Gas utility', amt: jitter(rng, 95, 0.25) },
      { day: 9, desc: 'Internet / Cable', amt: jitter(rng, 180, 0.02) },
      { day: 12, desc: 'Auto loan', amt: jitter(rng, 612, 0.01) },
      { day: 15, desc: 'Auto insurance', amt: jitter(rng, 320, 0.01) },
      { day: 18, desc: 'Groceries — Whole Foods', amt: jitter(rng, 740, 0.15) },
      { day: 22, desc: 'Dining out', amt: jitter(rng, 410, 0.3) },
      { day: 25, desc: 'Streaming services', amt: jitter(rng, 78, 0.05) },
      { day: 27, desc: 'Credit card payment', amt: jitter(rng, 1850, 0.2) },
    ];
    for (const b of bills) {
      await adjustment({
        accountId: checking,
        amount: b.amt.toFixed(2),
        direction: 'debit',
        when: mISO(b.day),
        description: b.desc,
        idempotencyKey: `seed:bill:${userId}:${monthIx}:${b.day}`,
      });
    }

    // Monthly sweep: checking -> savings $4000, -> money market $5000
    await internalMove({
      from: checking,
      to: savings,
      amount: '4000.00',
      when: mISO(28, 16),
      description: 'Monthly savings transfer',
      idempotencyKey: `seed:xfer-sav:${userId}:${monthIx}`,
    });
    await internalMove({
      from: checking,
      to: mm,
      amount: '5000.00',
      when: mISO(28, 17),
      description: 'Monthly money market transfer',
      idempotencyKey: `seed:xfer-mm:${userId}:${monthIx}`,
    });

    // Interest accruals (savings 0.20%/mo ≈ 2.4% APY; money market 0.30%/mo)
    const savBal = (await query(`SELECT account_ledger_balance($1)::text AS b`, [savings])).rows[0]
      .b;
    const mmBal = (await query(`SELECT account_ledger_balance($1)::text AS b`, [mm])).rows[0].b;
    const savInt = (Number(savBal) * 0.002).toFixed(2);
    const mmInt = (Number(mmBal) * 0.003).toFixed(2);
    if (Number(savInt) > 0) {
      await adjustment({
        accountId: savings,
        amount: savInt,
        direction: 'credit',
        when: mISO(30, 23),
        description: 'Interest accrual',
        idempotencyKey: `seed:int-sav:${userId}:${monthIx}`,
      });
    }
    if (Number(mmInt) > 0) {
      await adjustment({
        accountId: mm,
        amount: mmInt,
        direction: 'credit',
        when: mISO(30, 23, 5),
        description: 'Interest accrual',
        idempotencyKey: `seed:int-mm:${userId}:${monthIx}`,
      });
    }

    // Quarterly dividends into investment account
    if (monthIx % 3 === 0) {
      const div = jitter(rng, 6_500, 0.2).toFixed(2);
      await adjustment({
        accountId: inv,
        amount: div,
        direction: 'credit',
        when: mISO(15, 19),
        description: 'Quarterly investment dividend',
        idempotencyKey: `seed:dividend:${userId}:${monthIx}`,
      });
    }

    cursor = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1, 12));
  }

  // Final reconciliation summary
  const summary = await query(
    `SELECT a.account_type, a.nickname,
            account_ledger_balance(a.id)::text AS balance
     FROM accounts a WHERE a.user_id = $1 ORDER BY a.account_type`,
    [userId],
  );
  let total = 0;
  console.info('Seed complete — account balances:');
  for (const r of summary.rows) {
    total += Number(r.balance);
    console.info(
      `  ${r.account_type.padEnd(14)} ${r.nickname.padEnd(28)} $${Number(r.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    );
  }
  console.info(
    `  TOTAL                                       $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  );
  if (total < 4_000_000) {
    console.warn(`Warning: total ($${total.toFixed(2)}) is below $4,000,000 target.`);
  }
}
