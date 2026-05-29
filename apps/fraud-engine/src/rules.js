/**
 * Fraud rule pipeline. Each rule receives the same context object and returns
 * `{ score, severity, detail }` or null.
 */
import { query } from '@pine/lib-db';

export async function velocityRule({ userId, amount }) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::text AS total
       FROM transactions
      WHERE initiated_by_user_id = $1
        AND created_at > now() - INTERVAL '1 hour'`,
    [userId],
  );
  const r = rows[0];
  if (r.n >= 10)
    return {
      score: 35,
      severity: 'high',
      detail: { rule: 'velocity_count', windowMin: 60, count: r.n },
    };
  if (Number(r.total) + Number(amount) > 50_000) {
    return {
      score: 30,
      severity: 'medium',
      detail: { rule: 'velocity_amount', windowMin: 60, total: r.total },
    };
  }
  return null;
}

export async function largeAmountRule({ amount }) {
  const n = Number(amount);
  if (n >= 100_000)
    return { score: 40, severity: 'high', detail: { rule: 'large_amount', amount } };
  if (n >= 10_000)
    return { score: 20, severity: 'medium', detail: { rule: 'medium_amount', amount } };
  return null;
}

export async function offHoursRule() {
  const hr = new Date().getUTCHours();
  if (hr >= 5 && hr <= 10) return null; // ~midnight–6 ET
  return { score: 10, severity: 'low', detail: { rule: 'off_hours' } };
}

export async function newCounterpartyLargeRule({ transactionId }) {
  const { rows } = await query(
    `SELECT t.amount::text AS amount, c.created_at
       FROM transactions t LEFT JOIN counterparties c ON c.id = t.counterparty_id
      WHERE t.id = $1`,
    [transactionId],
  );
  const r = rows[0];
  if (!r || !r.created_at) return null;
  const ageHours = (Date.now() - new Date(r.created_at).getTime()) / 3_600_000;
  if (ageHours < 72 && Number(r.amount) >= 5_000) {
    return {
      score: 25,
      severity: 'medium',
      detail: { rule: 'new_counterparty_large', ageHours, amount: r.amount },
    };
  }
  return null;
}

export const RULES = [velocityRule, largeAmountRule, offHoursRule, newCounterpartyLargeRule];
