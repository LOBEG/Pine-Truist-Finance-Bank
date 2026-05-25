import { query } from '@pine/lib-db';

/** Same writer as core-banking-api/services/identity.js — copied to avoid cross-app imports. */
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
