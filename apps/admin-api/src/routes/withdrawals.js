import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import { adminWithdrawalDecisionSchema } from '@pine/lib-validation';
import { query, withTransaction } from '@pine/lib-db';
import { postTransaction } from '@pine/lib-ledger';
import { requirePermission } from '@pine/lib-auth/rbac';
import { writeAudit } from '../services/audit.js';
import { getExternalClearingAccount } from '../services/clearing.js';

export function buildWithdrawalsRouter({ publish, kekB64 }) {
  const router = Router();

  router.get(
    '/',
    requirePermission('withdrawal:approve'),
    asyncHandler(async (req, res) => {
      const status = req.query.status || 'pending';
      const { rows } = await query(
        `SELECT wr.id, wr.user_id, u.email, u.full_name,
                wr.account_id, a.account_type, a.account_number_last4,
                wr.amount::text AS amount, wr.method, wr.status,
                wr.requested_at, wr.notes, wr.hold_transaction_id
           FROM withdrawal_requests wr
           JOIN users u    ON u.id = wr.user_id
           JOIN accounts a ON a.id = wr.account_id
          WHERE wr.status = $1
          ORDER BY wr.requested_at DESC
          LIMIT 200`,
        [status],
      );
      res.json({ items: rows });
    }),
  );

  router.post(
    '/:id/approve',
    requirePermission('withdrawal:approve'),
    asyncHandler(async (req, res) => {
      const idempotencyKey =
        req.headers['idempotency-key'] || `withdrawal:${req.params.id}:approve`;

      // Single transaction: release the pending hold, post the actual debit (disbursement).
      const result = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `SELECT id, user_id, account_id, amount::text AS amount, method, status, hold_transaction_id
             FROM withdrawal_requests WHERE id = $1 FOR UPDATE`,
          [req.params.id],
        );
        const wr = rows[0];
        if (!wr) throw errors.notFound('withdrawal_not_found');
        if (wr.status !== 'pending') throw errors.conflict('not_pending', `Status is ${wr.status}`);

        // Release the hold (mark pending leg as released).
        await client.query(
          `UPDATE ledger_entries SET status = 'released'
            WHERE transaction_id = $1 AND status = 'pending'`,
          [wr.hold_transaction_id],
        );
        await client.query(`UPDATE transactions SET status = 'cancelled' WHERE id = $1`, [
          wr.hold_transaction_id,
        ]);

        await client.query(
          `UPDATE withdrawal_requests
             SET status = 'approved', reviewed_by_admin_id = $2, reviewed_at = now()
           WHERE id = $1`,
          [req.params.id, req.user.id],
        );
        return wr;
      });

      // Post the disbursement transaction outside the inner transaction
      // (so the hold release is committed before computing balance for posting).
      const clearingId = await getExternalClearingAccount(kekB64);
      const disbursement = await postTransaction({
        type: 'withdrawal',
        status: 'posted',
        idempotencyKey,
        amount: result.amount,
        description: `Withdrawal disbursement (${result.method})`,
        sourceAccountId: result.account_id,
        authorizedByAdminId: req.user.id,
        initiatedByUserId: result.user_id,
        entries: [
          { accountId: result.account_id, direction: 'debit', amount: result.amount },
          { accountId: clearingId, direction: 'credit', amount: result.amount },
        ],
      }).catch(async (err) => {
        // Rollback approval if posting fails.
        await query(
          `UPDATE withdrawal_requests SET status = 'pending', reviewed_by_admin_id = NULL, reviewed_at = NULL WHERE id = $1`,
          [req.params.id],
        );
        throw err;
      });

      await query(
        `UPDATE withdrawal_requests
           SET status = 'disbursed', disbursement_transaction_id = $2
         WHERE id = $1`,
        [req.params.id, disbursement.transactionId],
      );

      await writeAudit({
        actorUserId: req.user.id,
        actorRole: req.user.roles[0],
        action: 'admin.withdrawal.approved',
        resourceType: 'withdrawal_request',
        resourceId: req.params.id,
        after: { disbursementTransactionId: disbursement.transactionId },
        ip: req.ip,
        requestId: req.id,
      });
      await publish('withdrawal.approved', {
        withdrawalId: req.params.id,
        userId: result.user_id,
        amount: result.amount,
        transactionId: disbursement.transactionId,
      });

      res.json({
        withdrawalId: req.params.id,
        status: 'disbursed',
        transactionId: disbursement.transactionId,
      });
    }),
  );

  router.post(
    '/:id/reject',
    requirePermission('withdrawal:approve'),
    validate({ body: adminWithdrawalDecisionSchema }),
    asyncHandler(async (req, res) => {
      const reason = req.body.reason || 'Rejected by admin';
      const result = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `SELECT user_id, hold_transaction_id, status
             FROM withdrawal_requests WHERE id = $1 FOR UPDATE`,
          [req.params.id],
        );
        const wr = rows[0];
        if (!wr) throw errors.notFound('withdrawal_not_found');
        if (wr.status !== 'pending') throw errors.conflict('not_pending');

        await client.query(
          `UPDATE ledger_entries SET status = 'released'
            WHERE transaction_id = $1 AND status = 'pending'`,
          [wr.hold_transaction_id],
        );
        await client.query(`UPDATE transactions SET status = 'cancelled' WHERE id = $1`, [
          wr.hold_transaction_id,
        ]);
        await client.query(
          `UPDATE withdrawal_requests
             SET status = 'rejected', rejection_reason = $2,
                 reviewed_by_admin_id = $3, reviewed_at = now()
           WHERE id = $1`,
          [req.params.id, reason, req.user.id],
        );
        return wr;
      });

      await writeAudit({
        actorUserId: req.user.id,
        actorRole: req.user.roles[0],
        action: 'admin.withdrawal.rejected',
        resourceType: 'withdrawal_request',
        resourceId: req.params.id,
        after: { reason },
        ip: req.ip,
        requestId: req.id,
      });
      await publish('withdrawal.rejected', {
        withdrawalId: req.params.id,
        userId: result.user_id,
        reason,
      });

      res.json({ withdrawalId: req.params.id, status: 'rejected', reason });
    }),
  );

  return router;
}
