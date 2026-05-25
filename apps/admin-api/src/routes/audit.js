import { Router } from 'express';
import { asyncHandler, validate } from '@pine/lib-http';
import { paginationQuerySchema } from '@pine/lib-validation';
import { query } from '@pine/lib-db';
import { requirePermission } from '@pine/lib-auth/rbac';
import { z } from 'zod';

const auditQuerySchema = paginationQuerySchema.extend({
  actor: z.string().uuid().optional(),
  resourceType: z.string().max(40).optional(),
  resourceId: z.string().max(120).optional(),
  action: z.string().max(80).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export function buildAuditRouter() {
  const router = Router();

  router.get(
    '/',
    requirePermission('audit:read'),
    validate({ query: auditQuerySchema }),
    asyncHandler(async (req, res) => {
      const params = [];
      let where = '1=1';
      const q = req.query;
      if (q.actor) {
        params.push(q.actor);
        where += ` AND actor_user_id = $${params.length}::uuid`;
      }
      if (q.resourceType) {
        params.push(q.resourceType);
        where += ` AND resource_type = $${params.length}`;
      }
      if (q.resourceId) {
        params.push(q.resourceId);
        where += ` AND resource_id = $${params.length}`;
      }
      if (q.action) {
        params.push(q.action);
        where += ` AND action = $${params.length}`;
      }
      if (q.from) {
        params.push(q.from);
        where += ` AND created_at >= $${params.length}::date`;
      }
      if (q.to) {
        params.push(q.to);
        where += ` AND created_at < ($${params.length}::date + INTERVAL '1 day')`;
      }
      params.push(q.limit);

      const { rows } = await query(
        `SELECT id, actor_user_id, actor_role, action, resource_type, resource_id,
                before, after, ip::text AS ip, user_agent, request_id, created_at
           FROM audit_logs
          WHERE ${where}
          ORDER BY created_at DESC
          LIMIT $${params.length}`,
        params,
      );
      res.json({ items: rows });
    }),
  );

  return router;
}
