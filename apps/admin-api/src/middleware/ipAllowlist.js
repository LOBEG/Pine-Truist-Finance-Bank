import { errors } from '@pine/lib-http';

/**
 * Restrict admin-api to a comma-separated CIDR/IP allowlist when configured.
 * Empty allowlist disables the check (intended for internal Railway networking
 * + Cloudflare-fronted public ingress where Cloudflare itself enforces IP ACLs).
 */
export function ipAllowlist(allowlistCsv) {
  const list = (allowlistCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return (_req, _res, next) => next();
  const set = new Set(list);
  return (req, _res, next) => {
    const ip = (req.headers['cf-connecting-ip'] || req.ip || '').toString();
    if (!set.has(ip)) return next(errors.forbidden('ip_not_allowed', 'Source IP not allowed.'));
    next();
  };
}
