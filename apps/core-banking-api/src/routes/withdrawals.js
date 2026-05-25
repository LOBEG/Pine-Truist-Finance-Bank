import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import { withdrawalBodySchema } from '@pine/lib-validation';
import { query } from '@pine/lib-db';
import { postTransaction } from '@pine/lib-ledger';
import { writeAudit } from '../services/identity.js';
import { getExternalClearingAccount } from '../services/clearing.js';

export function buildWithdrawalsRouter({ publish, kekB64 }) {
  const router = Router();

  router.post(
    '/',
    validate({ body: withdrawalBodySchema }),
    asyncHandler(async (req, res) => {
      const idempotencyKey = req.headers['idempotency-key'];
      if (!idempotencyKey)
        throw errors.badRequest('idempotency_required', 'Idempotency-Key header required.');

      const { accountId, amount, method, notes } = req.body;
      const acc = await query(`SELECT id, status FROM accounts WHERE id = $1 AND user_id = $2`, [
        accountId,
        req.user.id,
      ]);
      if (!acc.rows[0]) throw errors.notFound('account_not_found');
      if (acc.rows[0].status !== 'active') throw errors.conflict('account_inactive');

      const clearingId = await getExternalClearingAccount(kekB64);

      // Place a balanced "hold" — pending debit on customer, pending credit
      // on clearing. The pending debit reduces availability; nothing posts
      // until admin approves and a separate disbursement is created.
      const hold = await postTransaction({
        type: 'withdrawal',
        status: 'pending',
        idempotencyKey: `${idempotencyKey}:hold`,
        amount,
        description: `Withdrawal hold (${method})`,
        sourceAccountId: accountId,
        initiatedByUserId: req.user.id,
        entries: [
          { accountId, direction: 'debit', amount, status: 'pending' },
          { accountId: clearingId, direction: 'credit', amount, status: 'pending' },
        ],
      });

      const wr = await query(
        `INSERT INTO withdrawal_requests
           (user_id, account_id, amount, method, notes, hold_transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, status, requested_at`,
        [req.user.id, accountId, amount, method, notes || null, hold.transactionId],
      );

      await writeAudit({
        actorUserId: req.user.id,
        action: 'withdrawal.requested',
        resourceType: 'withdrawal_request',
        resourceId: wr.rows[0].id,
        after: { amount, method, accountId },
        ip: req.ip,
        requestId: req.id,
      });
      await publish('withdrawal.requested', {
        withdrawalId: wr.rows[0].id,
        userId: req.user.id,
        accountId,
        amount,
        method,
      });

      res.status(201).json({ withdrawal: wr.rows[0], holdTransactionId: hold.transactionId });
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT id, account_id, amount::text AS amount, method, status, notes,
                requested_at, reviewed_at, rejection_reason,
                hold_transaction_id, disbursement_transaction_id
           FROM withdrawal_requests
          WHERE user_id = $1
          ORDER BY requested_at DESC
          LIMIT 100`,
        [req.user.id],
      );
      res.json({ items: rows });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT * FROM withdrawal_requests WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id],
      );
      if (!rows[0]) throw errors.notFound('withdrawal_not_found');
      res.json({ withdrawal: rows[0] });
    }),
  );

  return router;
}
