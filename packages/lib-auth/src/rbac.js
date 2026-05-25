import { errors } from '@pine/lib-http';

/**
 * Express middleware factory: require `req.user` to have a permission like
 * 'withdrawal:approve'. Wildcards: '*' on resource or action match anything.
 */
export function requirePermission(needed) {
  const [needRes, needAct] = needed.split(':');
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthorized());
    const perms = req.user.permissions || [];
    const ok = perms.some((p) => {
      const [res, act] = p.split(':');
      return (res === '*' || res === needRes) && (act === '*' || act === needAct);
    });
    if (!ok) return next(errors.forbidden('permission_denied', `Missing permission: ${needed}`));
    next();
  };
}

export function requireRole(...allowed) {
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthorized());
    const roles = req.user.roles || [];
    if (!roles.some((r) => allowed.includes(r))) {
      return next(errors.forbidden('role_required', `Requires one of: ${allowed.join(', ')}`));
    }
    next();
  };
}

export function requireMfa() {
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthorized());
    if (!req.user.mfaVerified)
      return next(errors.forbidden('mfa_required', 'MFA step-up required.'));
    next();
  };
}

/**
 * Canonical permission catalogue. Mirrored by the database seed in
 * db/migrations and used by lib-auth/rbac to validate `requirePermission`
 * argument strings.
 */
export const PERMISSIONS = Object.freeze({
  ACCOUNT_READ_SELF: 'account:read_self',
  TRANSACTION_READ_SELF: 'transaction:read_self',
  TRANSFER_INITIATE: 'transfer:initiate',
  WITHDRAWAL_REQUEST: 'withdrawal:request',

  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_FREEZE: 'user:freeze',
  ROLE_ASSIGN: 'role:assign',
  PIN_ISSUE: 'pin:issue',
  PIN_REVOKE: 'pin:revoke',
  WITHDRAWAL_APPROVE: 'withdrawal:approve',
  TRANSACTION_RELEASE: 'transaction:release',
  TRANSACTION_REVERSE: 'transaction:reverse',
  COMPLIANCE_READ: 'compliance:read',
  COMPLIANCE_WRITE: 'compliance:write',
  AUDIT_READ: 'audit:read',
  SETTINGS_WRITE: 'settings:write',
  ADMIN_ALL: '*:*',
});
