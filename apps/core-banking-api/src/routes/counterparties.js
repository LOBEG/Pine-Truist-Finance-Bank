import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import { counterpartyBodySchema } from '@pine/lib-validation';
import { query } from '@pine/lib-db';
import { encryptField } from '@pine/lib-crypto';

export function buildCounterpartiesRouter({ kekB64 }) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT id, name, bank_name, routing_number, account_number_last4,
                account_type, country, verified, created_at
           FROM counterparties
          WHERE user_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC`,
        [req.user.id],
      );
      res.json({ items: rows });
    }),
  );

  router.post(
    '/',
    validate({ body: counterpartyBodySchema }),
    asyncHandler(async (req, res) => {
      const { name, bankName, routingNumber, accountNumber, accountType, country } = req.body;
      const enc = encryptField(accountNumber, kekB64);
      const { rows } = await query(
        `INSERT INTO counterparties
           (user_id, name, bank_name, routing_number, account_number_encrypted,
            account_number_last4, account_type, country)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, bank_name, routing_number, account_number_last4, account_type, country, verified, created_at`,
        [
          req.user.id,
          name,
          bankName,
          routingNumber,
          enc,
          accountNumber.slice(-4).padStart(4, '0'),
          accountType,
          country,
        ],
      );
      res.status(201).json({ counterparty: rows[0] });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const r = await query(
        `UPDATE counterparties SET deleted_at = now()
           WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [req.params.id, req.user.id],
      );
      if (r.rowCount === 0) throw errors.notFound('counterparty_not_found');
      res.status(204).end();
    }),
  );

  return router;
}
