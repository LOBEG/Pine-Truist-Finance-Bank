import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import { adminPinBodySchema } from '@pine/lib-validation';
import { query } from '@pine/lib-db';
import { generateNumericPin, hashPin } from '@pine/lib-crypto';
import { requirePermission } from '@pine/lib-auth/rbac';
import { writeAudit } from '../services/audit.js';

export function buildPinsRouter({ publish }) {
  const router = Router();

  router.post(
    '/:userId/pins',
    requirePermission('pin:issue'),
    validate({ body: adminPinBodySchema }),
    asyncHandler(async (req, res) => {
      const { purpose, transactionId, expiresInMinutes } = req.body;
      const userRow = await query(`SELECT id FROM users WHERE id = $1`, [req.params.userId]);
      if (!userRow.rows[0]) throw errors.notFound('user_not_found');

      const pinPlain = generateNumericPin(6);
      const hashed = await hashPin(pinPlain);
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);

      const { rows } = await query(
        `INSERT INTO transfer_pins
           (user_id, pin_hash, purpose, transaction_id, generated_by_admin_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, purpose, expires_at, max_attempts`,
        [req.params.userId, hashed, purpose, transactionId || null, req.user.id, expiresAt],
      );

      await writeAudit({
        actorUserId: req.user.id,
        actorRole: req.user.roles[0],
        action: 'admin.pin.issued',
        resourceType: 'transfer_pin',
        resourceId: rows[0].id,
        after: { userId: req.params.userId, purpose, expiresAt },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });
      await publish('pin.issued', {
        pinId: rows[0].id,
        userId: req.params.userId,
        purpose,
        expiresAt,
      });

      // Plaintext PIN returned ONCE — admin must deliver to customer out-of-band.
      res.status(201).json({
        pin: pinPlain,
        pinId: rows[0].id,
        purpose: rows[0].purpose,
        expiresAt: rows[0].expires_at,
        maxAttempts: rows[0].max_attempts,
        warning: 'Plaintext PIN shown ONLY ONCE. Deliver to customer securely.',
      });
    }),
  );

  router.post(
    '/:userId/pins/:pinId/revoke',
    requirePermission('pin:revoke'),
    asyncHandler(async (req, res) => {
      const r = await query(
        `UPDATE transfer_pins SET status = 'revoked'
           WHERE id = $1 AND user_id = $2 AND status = 'active'`,
        [req.params.pinId, req.params.userId],
      );
      if (r.rowCount === 0) throw errors.notFound('pin_not_active');
      await writeAudit({
        actorUserId: req.user.id,
        actorRole: req.user.roles[0],
        action: 'admin.pin.revoked',
        resourceType: 'transfer_pin',
        resourceId: req.params.pinId,
        requestId: req.id,
      });
      await publish('pin.revoked', { pinId: req.params.pinId, userId: req.params.userId });
      res.status(204).end();
    }),
  );

  router.get(
    '/:userId/pins',
    requirePermission('pin:issue'),
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT id, purpose, status, expires_at, consumed_at, attempts, max_attempts,
                transaction_id, created_at
           FROM transfer_pins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [req.params.userId],
      );
      res.json({ items: rows });
    }),
  );

  return router;
}
