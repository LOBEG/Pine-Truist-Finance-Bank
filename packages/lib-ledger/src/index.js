import { withTransaction, query } from '@pine/lib-db';
import { errors } from '@pine/lib-http';

/**
 * Decimal math using bigint scaled to 4 decimal places (matches numeric(20,4)).
 * 1 dollar = 10000 units. Caller passes plain decimal strings/numbers.
 */
const SCALE = 10_000n;

export function toUnits(amount) {
  if (typeof amount === 'bigint') return amount;
  const s = typeof amount === 'string' ? amount.trim() : String(amount);
  if (!/^-?\d+(\.\d{1,4})?$/.test(s)) throw new Error(`Invalid amount: ${amount}`);
  const neg = s.startsWith('-');
  const abs = neg ? s.slice(1) : s;
  const [intPart, fracPart = ''] = abs.split('.');
  const padded = (fracPart + '0000').slice(0, 4);
  const v = BigInt(intPart) * SCALE + BigInt(padded);
  return neg ? -v : v;
}

export function fromUnits(units) {
  const u = BigInt(units);
  const neg = u < 0n;
  const abs = neg ? -u : u;
  const intPart = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(4, '0');
  return `${neg ? '-' : ''}${intPart}.${frac}`;
}

export function unitsToString(units) {
  return fromUnits(units);
}

// --------------------- Balance computation ---------------------

/**
 * Returns { available, ledger, pendingDebits, pendingCredits } for an account
 * computed from ledger_entries (single source of truth).
 *
 *   ledger    = posted credits  - posted debits
 *   available = ledger - pending_debits + pending_credits available
 *
 * For Reg CC simplicity, pending_credits do not increase availability; this
 * matches typical bank behavior (deposits hold for funds availability).
 */
export async function computeBalance(accountId, client = null) {
  const exec = client ? (q, p) => client.query(q, p) : (q, p) => query(q, p);
  const { rows } = await exec(
    `SELECT
       COALESCE(SUM(CASE WHEN direction='credit' AND status='posted' THEN amount ELSE 0 END),0)::text AS posted_credits,
       COALESCE(SUM(CASE WHEN direction='debit'  AND status='posted' THEN amount ELSE 0 END),0)::text AS posted_debits,
       COALESCE(SUM(CASE WHEN direction='debit'  AND status='pending' THEN amount ELSE 0 END),0)::text AS pending_debits,
       COALESCE(SUM(CASE WHEN direction='credit' AND status='pending' THEN amount ELSE 0 END),0)::text AS pending_credits
     FROM ledger_entries WHERE account_id = $1`,
    [accountId],
  );
  const r = rows[0];
  const ledger = toUnits(r.posted_credits) - toUnits(r.posted_debits);
  const pendingDebits = toUnits(r.pending_debits);
  const pendingCredits = toUnits(r.pending_credits);
  const available = ledger - pendingDebits;
  return {
    ledger: unitsToString(ledger),
    available: unitsToString(available),
    pendingDebits: unitsToString(pendingDebits),
    pendingCredits: unitsToString(pendingCredits),
  };
}

// --------------------- Posting engine ---------------------

/**
 * Atomically post a transaction with N balanced entries.
 *
 * @param {object} input
 * @param {string} input.type - One of transactions.type values.
 * @param {string} input.status - 'posted' (default), 'pending', etc.
 * @param {string} input.idempotencyKey - Required for money-movement endpoints.
 * @param {string} [input.initiatedByUserId]
 * @param {string} [input.authorizedByAdminId]
 * @param {string} [input.pinAuthorizationId]
 * @param {string} [input.sourceAccountId]
 * @param {string} [input.destinationAccountId]
 * @param {string} [input.counterpartyId]
 * @param {string|number} input.amount - Display amount (positive).
 * @param {string} [input.currency='USD']
 * @param {string} [input.description]
 * @param {string} [input.memo]
 * @param {Array<{accountId:string,direction:'debit'|'credit',amount:string|number,status?:string,valueDate?:string}>} input.entries
 * @returns {Promise<{transactionId:string, status:string}>}
 */
export async function postTransaction(input) {
  const {
    type,
    status = 'posted',
    idempotencyKey,
    initiatedByUserId = null,
    authorizedByAdminId = null,
    pinAuthorizationId = null,
    sourceAccountId = null,
    destinationAccountId = null,
    counterpartyId = null,
    amount,
    currency = 'USD',
    description = null,
    memo = null,
    entries,
  } = input;

  if (!idempotencyKey)
    throw errors.badRequest('idempotency_required', 'idempotencyKey is required.');
  if (!Array.isArray(entries) || entries.length < 1) {
    throw errors.badRequest('invalid_entries', 'At least one ledger entry is required.');
  }

  // Balance check (debits == credits) for posted entries within this txn.
  // Pending entries are holds and don't need to balance until they post
  // (e.g. ACH/wire outbound, customer withdrawal hold).
  let postedSum = 0n;
  let hasPosted = false;
  for (const e of entries) {
    const u = toUnits(e.amount);
    if (u <= 0n) throw errors.badRequest('invalid_entry_amount', 'Entry amount must be positive.');
    const entryStatus = e.status || status;
    if (entryStatus === 'posted') {
      hasPosted = true;
      postedSum += e.direction === 'credit' ? u : -u;
    }
  }
  if (hasPosted && postedSum !== 0n) {
    throw errors.badRequest(
      'unbalanced_entries',
      'Sum of posted debits must equal sum of posted credits.',
    );
  }

  return withTransaction(async (client) => {
    // Idempotency: if a transaction with this key exists, return it.
    const existing = await client.query(
      'SELECT id, status FROM transactions WHERE idempotency_key = $1',
      [idempotencyKey],
    );
    if (existing.rows[0]) {
      return {
        transactionId: existing.rows[0].id,
        status: existing.rows[0].status,
        idempotent: true,
      };
    }

    // Lock relevant accounts in deterministic order to avoid deadlocks.
    const lockIds = Array.from(new Set(entries.map((e) => e.accountId).filter(Boolean))).sort();
    if (lockIds.length) {
      await client.query(
        `SELECT id FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
        [lockIds],
      );
    }

    // Verify accounts exist, active, and sufficient available balance for debits.
    // CRITICAL: Both posted AND pending debits reduce availability. A pending
    // debit is a hold (ACH outbound / wire outbound / withdrawal hold) that
    // will eventually consume real funds, so it must reserve availability at
    // creation time. Failing to do so allowed overdraft when multiple holds
    // raced against the same account.
    const debitTotals = new Map();
    for (const e of entries) {
      if (e.direction === 'debit') {
        const entryStatus = e.status || status;
        if (entryStatus === 'posted' || entryStatus === 'pending') {
          debitTotals.set(e.accountId, (debitTotals.get(e.accountId) || 0n) + toUnits(e.amount));
        }
      }
    }
    for (const [accId, needed] of debitTotals) {
      const { rows } = await client.query(`SELECT status FROM accounts WHERE id = $1`, [accId]);
      if (!rows[0]) throw errors.notFound('account_not_found', `Account ${accId} not found.`);
      if (rows[0].status !== 'active') {
        throw errors.conflict('account_inactive', `Account ${accId} is not active.`);
      }
      const bal = await computeBalance(accId, client);
      if (toUnits(bal.available) < needed) {
        throw errors.conflict('insufficient_funds', 'Insufficient available balance.', {
          accountId: accId,
          available: bal.available,
          required: fromUnits(needed),
        });
      }
    }

    const insertTxn = await client.query(
      `INSERT INTO transactions
         (type, status, source_account_id, destination_account_id, counterparty_id,
          amount, currency, description, memo, idempotency_key,
          initiated_by_user_id, authorized_by_admin_id, pin_authorization_id,
          posted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
               CASE WHEN $2 = 'posted' THEN now() ELSE NULL END)
       RETURNING id`,
      [
        type,
        status,
        sourceAccountId,
        destinationAccountId,
        counterpartyId,
        fromUnits(toUnits(amount)),
        currency,
        description,
        memo,
        idempotencyKey,
        initiatedByUserId,
        authorizedByAdminId,
        pinAuthorizationId,
      ],
    );
    const transactionId = insertTxn.rows[0].id;

    for (const e of entries) {
      const entryStatus = e.status || status;
      await client.query(
        `INSERT INTO ledger_entries
           (transaction_id, account_id, direction, amount, currency, status, posted_at, value_date)
         VALUES ($1,$2,$3,$4,$5,$6,
                 CASE WHEN $6 = 'posted' THEN now() ELSE NULL END,
                 COALESCE($7::date, CURRENT_DATE))`,
        [
          transactionId,
          e.accountId,
          e.direction,
          fromUnits(toUnits(e.amount)),
          currency,
          entryStatus,
          e.valueDate || null,
        ],
      );
    }

    await client.query(
      `INSERT INTO transaction_events (transaction_id, event_type, payload)
       VALUES ($1, $2, $3)`,
      [
        transactionId,
        `transaction.${status}`,
        JSON.stringify({ type, amount: fromUnits(toUnits(amount)) }),
      ],
    );

    // Write to outbox for at-least-once event delivery.
    await client.query(`INSERT INTO outbox (topic, payload) VALUES ($1, $2)`, [
      `transaction.${status}`,
      JSON.stringify({
        transactionId,
        type,
        status,
        sourceAccountId,
        destinationAccountId,
        amount: fromUnits(toUnits(amount)),
        currency,
        initiatedByUserId,
      }),
    ]);

    return { transactionId, status };
  });
}
