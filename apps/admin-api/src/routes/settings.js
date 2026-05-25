import { Router } from 'express';
import { asyncHandler, validate } from '@pine/lib-http';
import { query } from '@pine/lib-db';
import { requirePermission } from '@pine/lib-auth/rbac';
import { writeAudit } from '../services/audit.js';
import { z } from 'zod';

const settingBodySchema = z.object({ value: z.any() });

export function buildSettingsRouter() {
  const router = Router();

  router.get(
    '/',
    requirePermission('settings:write'),
    asyncHandler(async (_req, res) => {
      const { rows } = await query(
        `SELECT key, value, description, updated_at FROM system_settings ORDER BY key`,
      );
      res.json({ items: rows });
    }),
  );

  router.patch(
    '/:key',
    requirePermission('settings:write'),
    validate({ body: settingBodySchema }),
    asyncHandler(async (req, res) => {
      const before = await query(`SELECT value FROM system_settings WHERE key = $1`, [
        req.params.key,
      ]);
      const { rows } = await query(
        `INSERT INTO system_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING key, value, updated_at`,
        [req.params.key, JSON.stringify(req.body.value), req.user.id],
      );
      await writeAudit({
        actorUserId: req.user.id,
        action: 'admin.settings.updated',
        resourceType: 'system_setting',
        resourceId: req.params.key,
        before: before.rows[0] || null,
        after: rows[0],
        requestId: req.id,
      });
      res.json({ setting: rows[0] });
    }),
  );

  return router;
}
