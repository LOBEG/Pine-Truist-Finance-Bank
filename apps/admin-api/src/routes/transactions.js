import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import { paginationQuerySchema } from '@pine/lib-validation';
import { query, withTransaction } from '@pine/lib-db';
import { postTransaction } from '@pine/lib-ledger';
import { requirePermission } from '@pine/lib-auth/rbac';
import { writeAudit } from '../services/audit.js';

export function buildTransactionsRouter({ publish }) {
  const router = Router();

  router.get(
    '/flagged',
    requirePermission('transaction:release'),
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT t.id, t.type, t.status, t.amount::text AS amount, t.currency,
                t.description, t.created_at, t.initiated_by_user_id,
                u.email AS initiator_email
           FROM transactions t
           LEFT JOIN users u ON u.id = t.initiated_by_user_id
          WHERE t.status IN ('pending_review','pending')
          ORDER BY t.created_at DESC
          LIMIT $1`,
        [req.query.limit],
      );
      res.json({ items: rows });
    }),
  );

  router.post(
    '/:id/release',
    requirePermission('transaction:release'),
    asyncHandler(async (req, res) => {
      const r = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `SELECT id, status FROM transactions WHERE id = $1 FOR UPDATE`,
          [req.params.id],
        );
        if (!rows[0]) throw errors.notFound('transaction_not_found');
        if (!['pending_review', 'pending'].includes(rows[0].status))
          throw errors.conflict('not_releasable', `status=${rows[0].status}`);
        await client.query(
          `UPDATE transactions SET status = 'posted', posted_at = now() WHERE id = $1`,
          [req.params.id],
        );
        await client.query(
          `UPDATE ledger_entries SET status = 'posted', posted_at = now()
            WHERE transaction_id = $1 AND status = 'pending'`,
          [req.params.id],
        );
        return rows[0];
      });
      await writeAudit({
        actorUserId: req.user.id,
        action: 'admin.transaction.released',
        resourceType: 'transaction',
        resourceId: req.params.id,
        before: r,
        after: { status: 'posted' },
        requestId: req.id,
      });
      await publish('transaction.posted', {
        transactionId: req.params.id,
        releasedByAdminId: req.user.id,
      });
      res.status(204).end();
    }),
  );

  router.post(
    '/:id/reverse',
    requirePermission('transaction:reverse'),
    asyncHandler(async (req, res) => {
      const idempotencyKey = req.headers['idempotency-key'] || `reverse:${req.params.id}`;
      const { rows } = await query(
        `SELECT id, status, type, amount::text AS amount, source_account_id, destination_account_id
           FROM transactions WHERE id = $1`,
        [req.params.id],
      );
      const t = rows[0];
      if (!t) throw errors.notFound('transaction_not_found');
      if (t.status !== 'posted') throw errors.conflict('not_posted', `status=${t.status}`);

      const entriesRes = await query(
        `SELECT account_id, direction, amount::text AS amount
           FROM ledger_entries WHERE transaction_id = $1 AND status = 'posted'`,
        [t.id],
      );
      // Mirror entries: flip each direction.
      const entries = entriesRes.rows.map((e) => ({
        accountId: e.account_id,
        direction: e.direction === 'debit' ? 'credit' : 'debit',
        amount: e.amount,
      }));

      const result = await postTransaction({
        type: 'reversal',
        status: 'posted',
        idempotencyKey,
        amount: t.amount,
        description: `Reversal of ${t.id}`,
        sourceAccountId: t.destination_account_id,
        destinationAccountId: t.source_account_id,
        authorizedByAdminId: req.user.id,
        entries,
      });

      await query(`UPDATE transactions SET status = 'reversed' WHERE id = $1`, [t.id]);
      await writeAudit({
        actorUserId: req.user.id,
        action: 'admin.transaction.reversed',
        resourceType: 'transaction',
        resourceId: req.params.id,
        after: { reversalTransactionId: result.transactionId },
        requestId: req.id,
      });
      await publish('transaction.reversed', {
        transactionId: req.params.id,
        reversalTransactionId: result.transactionId,
      });
      res.json({ reversalTransactionId: result.transactionId });
    }),
  );

  return router;
}
