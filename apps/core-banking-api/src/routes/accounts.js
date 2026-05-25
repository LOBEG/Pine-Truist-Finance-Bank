import { Router } from 'express';
import { asyncHandler, errors } from '@pine/lib-http';
import { query } from '@pine/lib-db';
import { computeBalance } from '@pine/lib-ledger';

export function buildAccountsRouter() {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT id, account_type, nickname, account_number_last4, routing_number,
                currency, status, opened_at
           FROM accounts
          WHERE user_id = $1 AND status != 'closed'
          ORDER BY opened_at`,
        [req.user.id],
      );
      const accounts = await Promise.all(
        rows.map(async (a) => {
          const b = await computeBalance(a.id);
          return {
            id: a.id,
            type: a.account_type,
            nickname: a.nickname,
            mask: a.account_number_last4,
            routingNumber: a.routing_number,
            currency: a.currency,
            status: a.status,
            openedAt: a.opened_at,
            balances: {
              available_balance: b.available,
              ledger_balance: b.ledger,
              pending_debits: b.pendingDebits,
              pending_credits: b.pendingCredits,
            },
          };
        }),
      );
      res.json({ accounts });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT id, user_id, account_type, nickname, account_number_last4,
                routing_number, currency, status, opened_at
           FROM accounts WHERE id = $1`,
        [req.params.id],
      );
      const a = rows[0];
      if (!a || a.user_id !== req.user.id) throw errors.notFound('account_not_found');
      const bal = await computeBalance(a.id);
      res.json({
        id: a.id,
        type: a.account_type,
        nickname: a.nickname,
        mask: a.account_number_last4,
        routingNumber: a.routing_number,
        currency: a.currency,
        status: a.status,
        openedAt: a.opened_at,
        balances: {
          available_balance: bal.available,
          ledger_balance: bal.ledger,
          pending_debits: bal.pendingDebits,
          pending_credits: bal.pendingCredits,
        },
      });
    }),
  );

  router.get(
    '/:id/balance',
    asyncHandler(async (req, res) => {
      const { rows } = await query(`SELECT user_id FROM accounts WHERE id = $1`, [req.params.id]);
      if (!rows[0] || rows[0].user_id !== req.user.id) throw errors.notFound('account_not_found');
      const bal = await computeBalance(req.params.id);
      res.json({ accountId: req.params.id, ...bal });
    }),
  );

  return router;
}
