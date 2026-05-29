import { Router } from 'express';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import { paginationQuerySchema } from '@pine/lib-validation';
import { query } from '@pine/lib-db';
import { requirePermission } from '@pine/lib-auth/rbac';
import { writeAudit } from '../services/audit.js';
import { z } from 'zod';

const caseBodySchema = z.object({
  userId: z.string().uuid().optional(),
  caseType: z.enum(['KYC', 'AML', 'SAR', 'CTR']),
  notes: z.string().max(2000).optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .optional(),
  relatedTransactionId: z.string().uuid().optional(),
});

const casePatchSchema = z.object({
  status: z.enum(['open', 'investigating', 'closed', 'reported']).optional(),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export function buildComplianceRouter() {
  const router = Router();

  router.get(
    '/cases',
    requirePermission('compliance:read'),
    validate({ query: paginationQuerySchema }),
    asyncHandler(async (req, res) => {
      const { rows } = await query(
        `SELECT id, user_id, case_type, status, opened_by, assigned_to,
                amount::text AS amount, related_transaction_id, notes, created_at, closed_at
           FROM compliance_cases
          ORDER BY created_at DESC
          LIMIT $1`,
        [req.query.limit],
      );
      res.json({ items: rows });
    }),
  );

  router.post(
    '/cases',
    requirePermission('compliance:write'),
    validate({ body: caseBodySchema }),
    asyncHandler(async (req, res) => {
      const { userId, caseType, notes, amount, relatedTransactionId } = req.body;
      const { rows } = await query(
        `INSERT INTO compliance_cases
           (user_id, case_type, status, opened_by, notes, amount, related_transaction_id)
         VALUES ($1, $2, 'open', $3, $4, $5, $6)
         RETURNING *`,
        [
          userId || null,
          caseType,
          req.user.id,
          notes || null,
          amount || null,
          relatedTransactionId || null,
        ],
      );
      await writeAudit({
        actorUserId: req.user.id,
        action: 'admin.compliance.case_opened',
        resourceType: 'compliance_case',
        resourceId: rows[0].id,
        after: { caseType, userId },
        requestId: req.id,
      });
      res.status(201).json({ case: rows[0] });
    }),
  );

  router.patch(
    '/cases/:id',
    requirePermission('compliance:write'),
    validate({ body: casePatchSchema }),
    asyncHandler(async (req, res) => {
      const patch = req.body;
      const before = await query(`SELECT * FROM compliance_cases WHERE id = $1`, [req.params.id]);
      if (!before.rows[0]) throw errors.notFound('case_not_found');

      const sets = [];
      const params = [req.params.id];
      if (patch.status) {
        params.push(patch.status);
        sets.push(`status = $${params.length}`);
      }
      if (patch.status === 'closed' || patch.status === 'reported') {
        sets.push(`closed_at = now()`);
      }
      if (patch.assignedTo) {
        params.push(patch.assignedTo);
        sets.push(`assigned_to = $${params.length}`);
      }
      if (patch.notes) {
        params.push(patch.notes);
        sets.push(`notes = $${params.length}`);
      }
      if (sets.length === 0) return res.status(204).end();

      const { rows } = await query(
        `UPDATE compliance_cases SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
        params,
      );
      await writeAudit({
        actorUserId: req.user.id,
        action: 'admin.compliance.case_updated',
        resourceType: 'compliance_case',
        resourceId: req.params.id,
        before: before.rows[0],
        after: rows[0],
        requestId: req.id,
      });
      res.json({ case: rows[0] });
    }),
  );

  return router;
}
