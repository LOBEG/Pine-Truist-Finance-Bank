import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import { paginationQuerySchema } from '@pine/lib-validation';
import { query } from '@pine/lib-db';
import { requirePermission } from '@pine/lib-auth/rbac';
import { writeAudit } from '../services/audit.js';
import { z } from 'zod';

const updateUserSchema = z.object({
  status: z.enum(['active', 'frozen']).optional(),
  kycStatus: z.enum(['pending', 'approved', 'rejected', 'review']).optional(),
});

const assignRoleSchema = z.object({
  role: z.enum(['customer', 'support', 'admin', 'compliance_officer', 'auditor', 'super_admin']),
});

export function buildUsersRouter() {
  const router = Router();

  router.get(
    '/',
    requirePermission('user:read'),
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req, res) => {
      const { limit, cursor } = req.query;
      const params = [];
      let where = '1=1';
      if (cursor) {
        params.push(cursor);
        where = `created_at < $${params.length}::timestamptz`;
      }
      params.push(limit);
      const { rows } = await query(
        `SELECT u.id, u.email, u.full_name, u.kyc_status, u.mfa_enabled,
                u.failed_login_count, u.locked_until, u.created_at,
                (SELECT array_agg(r.name) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id) AS roles
         FROM users u WHERE ${where} ORDER BY u.created_at DESC LIMIT $${params.length}`,
        params,
      );
      res.json({ items: rows });
    }),
  );

  router.get(
    '/:id',
    requirePermission('user:read'),
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT u.id, u.email, u.full_name, u.phone, u.kyc_status, u.mfa_enabled,
                u.failed_login_count, u.locked_until, u.last_login_at, u.created_at,
                (SELECT array_agg(r.name) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id) AS roles
         FROM users u WHERE u.id = $1`,
        [req.params.id],
      );
      if (!rows[0]) throw errors.notFound('user_not_found');
      const accounts = await query(
        `SELECT id, account_type, nickname, account_number_last4, status, opened_at,
                account_ledger_balance(id)::text AS ledger_balance,
                account_available_balance(id)::text AS available_balance
           FROM accounts WHERE user_id = $1 ORDER BY opened_at`,
        [req.params.id],
      );
      res.json({ user: rows[0], accounts: accounts.rows });
    }),
  );

  router.patch(
    '/:id',
    requirePermission('user:write'),
    validate({ body: updateUserSchema }),
    asyncHandler(async (req, res) => {
      const before = await query(`SELECT id, kyc_status FROM users WHERE id = $1`, [req.params.id]);
      if (!before.rows[0]) throw errors.notFound('user_not_found');

      const patch = req.body;
      const sets = [];
      const params = [req.params.id];
      if (patch.kycStatus) {
        params.push(patch.kycStatus);
        sets.push(`kyc_status = $${params.length}`);
      }
      if (sets.length === 0) return res.status(204).end();

      await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, params);

      if (patch.status === 'frozen') {
        await query(
          `UPDATE accounts SET status = 'frozen' WHERE user_id = $1 AND status != 'closed'`,
          [req.params.id],
        );
      }

      await writeAudit({
        actorUserId: req.user.id,
        actorRole: req.user.roles[0],
        action: 'admin.user.updated',
        resourceType: 'user',
        resourceId: req.params.id,
        before: before.rows[0],
        after: patch,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });
      res.status(204).end();
    }),
  );

  router.post(
    '/:id/roles',
    requirePermission('role:assign'),
    validate({ body: assignRoleSchema }),
    asyncHandler(async (req, res) => {
      const userExists = await query(`SELECT 1 FROM users WHERE id = $1`, [req.params.id]);
      if (userExists.rowCount === 0) throw errors.notFound('user_not_found');
      await query(
        `INSERT INTO user_roles (user_id, role_id, granted_by)
         SELECT $1, id, $2 FROM roles WHERE name = $3
         ON CONFLICT DO NOTHING`,
        [req.params.id, req.user.id, req.body.role],
      );
      await writeAudit({
        actorUserId: req.user.id,
        action: 'admin.role.assigned',
        resourceType: 'user',
        resourceId: req.params.id,
        after: { role: req.body.role },
        requestId: req.id,
      });
      res.status(204).end();
    }),
  );

  router.post(
    '/:id/freeze',
    requirePermission('user:freeze'),
    asyncHandler(async (req, res) => {
      await query(
        `UPDATE accounts SET status = 'frozen' WHERE user_id = $1 AND status = 'active'`,
        [req.params.id],
      );
      await writeAudit({
        actorUserId: req.user.id,
        action: 'admin.user.frozen',
        resourceType: 'user',
        resourceId: req.params.id,
        requestId: req.id,
      });
      res.status(204).end();
    }),
  );

  router.post(
    '/:id/unfreeze',
    requirePermission('user:freeze'),
    asyncHandler(async (req, res) => {
      await query(
        `UPDATE accounts SET status = 'active' WHERE user_id = $1 AND status = 'frozen'`,
        [req.params.id],
      );
      await query(`UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE id = $1`, [
        req.params.id,
      ]);
      await writeAudit({
        actorUserId: req.user.id,
        action: 'admin.user.unfrozen',
        resourceType: 'user',
        resourceId: req.params.id,
        requestId: req.id,
      });
      res.status(204).end();
    }),
  );

  return router;
}
