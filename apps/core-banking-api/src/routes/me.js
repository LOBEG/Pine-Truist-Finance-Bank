import { Router } from 'express';
import { asyncHandler } from '@pine/lib-http';
import { query } from '@pine/lib-db';

export function buildMeRouter() {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT u.id, u.email, u.full_name, u.phone, u.kyc_status, u.mfa_enabled,
                u.last_login_at, u.created_at
           FROM users u WHERE u.id = $1`,
        [req.user.id],
      );
      res.json({ user: rows[0], roles: req.user.roles, permissions: req.user.permissions });
    }),
  );

  return router;
}
