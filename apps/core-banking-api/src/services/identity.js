import { query } from '@pine/lib-db';

/**
 * Resolve user roles + permissions. Cached behind Redis with short TTL.
 */
export async function loadUserPermissions(userId) {
  const { rows } = await query(
    `SELECT DISTINCT r.name AS role, p.resource, p.action
       FROM user_roles ur
       JOIN roles r              ON r.id = ur.role_id
       JOIN role_permissions rp  ON rp.role_id = r.id
       JOIN permissions p        ON p.id = rp.permission_id
      WHERE ur.user_id = $1`,
    [userId],
  );
  const roles = [...new Set(rows.map((r) => r.role))];
  const permissions = [...new Set(rows.map((r) => `${r.resource}:${r.action}`))];
  return { roles, permissions };
}

export async function writeAudit({
  actorUserId = null,
  actorRole = null,
  action,
  resourceType = null,
  resourceId = null,
  before = null,
  after = null,
  ip = null,
  userAgent = null,
  requestId = null,
  correlationId = null,
}) {
  await query(
    `INSERT INTO audit_logs
       (actor_user_id, actor_role, action, resource_type, resource_id,
        before, after, ip, user_agent, request_id, correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::inet,$9,$10,$11)`,
    [
      actorUserId,
      actorRole,
      action,
      resourceType,
      resourceId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      ip,
      userAgent,
      requestId,
      correlationId,
    ],
  );
}
