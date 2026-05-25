import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import { transactionListQuerySchema } from '@pine/lib-validation';
import { query } from '@pine/lib-db';

export function buildTransactionsRouter() {
  const router = Router();

  router.get(
    '/',
    validate({ query: transactionListQuerySchema }),
    asyncHandler(async (req, res) => {
      const { accountId, from, to, type, status, cursor, limit } = req.query;

      // Ownership check on accountId if provided.
      if (accountId) {
        const { rows } = await query(`SELECT user_id FROM accounts WHERE id = $1`, [accountId]);
        if (!rows[0] || rows[0].user_id !== req.user.id) throw errors.notFound('account_not_found');
      }

      const params = [req.user.id];
      let where = `(t.initiated_by_user_id = $1
                    OR EXISTS (SELECT 1 FROM accounts a
                               WHERE a.user_id = $1
                                 AND (a.id = t.source_account_id OR a.id = t.destination_account_id)))`;

      if (accountId) {
        params.push(accountId);
        where += ` AND (t.source_account_id = $${params.length} OR t.destination_account_id = $${params.length})`;
      }
      if (from) {
        params.push(from);
        where += ` AND t.created_at >= $${params.length}::timestamptz`;
      }
      if (to) {
        params.push(to);
        where += ` AND t.created_at < ($${params.length}::date + INTERVAL '1 day')`;
      }
      if (type) {
        params.push(type);
        where += ` AND t.type = $${params.length}`;
      }
      if (status) {
        params.push(status);
        where += ` AND t.status = $${params.length}`;
      }
      if (cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
          params.push(decoded.ts);
          params.push(decoded.id);
          where += ` AND (t.created_at, t.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
        } catch {
          throw errors.badRequest('invalid_cursor', 'Cursor is invalid.');
        }
      }

      params.push(limit);
      const { rows } = await query(
        `SELECT t.id, t.type, t.status, t.amount::text AS amount, t.currency,
                t.description, t.memo,
                t.source_account_id, t.destination_account_id,
                t.created_at, t.posted_at
           FROM transactions t
          WHERE ${where}
          ORDER BY t.created_at DESC, t.id DESC
          LIMIT $${params.length}`,
        params,
      );

      let nextCursor = null;
      if (rows.length === limit) {
        const last = rows[rows.length - 1];
        nextCursor = Buffer.from(JSON.stringify({ ts: last.created_at, id: last.id })).toString(
          'base64url',
        );
      }
      res.json({ items: rows, nextCursor });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { rows } = await query(`SELECT t.* FROM transactions t WHERE t.id = $1`, [
        req.params.id,
      ]);
      const t = rows[0];
      if (!t) throw errors.notFound('transaction_not_found');
      // Authorization: user must own one of the involved accounts or be initiator.
      const ownership = await query(
        `SELECT 1 FROM accounts a
          WHERE a.user_id = $1
            AND a.id IN ($2::uuid, $3::uuid) LIMIT 1`,
        [req.user.id, t.source_account_id, t.destination_account_id],
      );
      if (t.initiated_by_user_id !== req.user.id && ownership.rowCount === 0) {
        throw errors.notFound('transaction_not_found');
      }
      const entries = await query(
        `SELECT account_id, direction, amount::text AS amount, status, posted_at, value_date
           FROM ledger_entries WHERE transaction_id = $1 ORDER BY id`,
        [t.id],
      );
      res.json({ transaction: t, entries: entries.rows });
    }),
  );

  return router;
}
