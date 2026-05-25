import { errors } from '@pine/lib-http';
import net from 'node:net';

/**
 * Restrict admin-api to a comma-separated list of IP literals and/or
 * CIDR ranges (IPv4 and IPv6). Empty list disables the check.
 *
 * Examples:
 *   "10.0.0.0/8,192.168.1.42,2001:db8::/32"
 *
 * The middleware reads `cf-connecting-ip` (Cloudflare) first, then falls
 * back to `req.ip`. Both proxy chains MUST be trusted by `app.set('trust proxy')`
 * before this middleware runs, or it will allow IP spoofing via headers.
 */
export function ipAllowlist(allowlistCsv) {
  const rules = (allowlistCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseRule)
    .filter(Boolean);

  if (rules.length === 0) return (_req, _res, next) => next();

  return (req, _res, next) => {
    const raw = (req.headers['cf-connecting-ip'] || req.ip || '').toString();
    // Normalise IPv4-mapped IPv6 ("::ffff:1.2.3.4") to plain IPv4.
    const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
    if (!ip || !rules.some((rule) => rule.match(ip))) {
      return next(errors.forbidden('ip_not_allowed', 'Source IP not allowed.'));
    }
    next();
  };
}

function parseRule(entry) {
  if (entry.includes('/')) {
    const [addr, bitsStr] = entry.split('/');
    const bits = Number(bitsStr);
    if (!Number.isInteger(bits) || bits < 0) return null;
    const family = net.isIPv6(addr) ? 6 : net.isIPv4(addr) ? 4 : null;
    if (!family) return null;
    if ((family === 4 && bits > 32) || (family === 6 && bits > 128)) return null;
    const network = ipToBigInt(addr, family);
    const total = family === 4 ? 32 : 128;
    const mask = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(total - bits);
    const networkMasked = network & mask;
    return {
      match(candidate) {
        const candFamily = net.isIPv6(candidate) ? 6 : net.isIPv4(candidate) ? 4 : null;
        if (candFamily !== family) return false;
        const candInt = ipToBigInt(candidate, family);
        return (candInt & mask) === networkMasked;
      },
    };
  }
  // Single IP literal.
  if (!net.isIP(entry)) return null;
  const family = net.isIPv6(entry) ? 6 : 4;
  const target = ipToBigInt(entry, family);
  return {
    match(candidate) {
      const candFamily = net.isIPv6(candidate) ? 6 : net.isIPv4(candidate) ? 4 : null;
      if (candFamily !== family) return false;
      return ipToBigInt(candidate, family) === target;
    },
  };
}

function ipToBigInt(addr, family) {
  if (family === 4) {
    const parts = addr.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
      throw new Error(`invalid_ipv4:${addr}`);
    }
    return (
      (BigInt(parts[0]) << 24n) |
      (BigInt(parts[1]) << 16n) |
      (BigInt(parts[2]) << 8n) |
      BigInt(parts[3])
    );
  }
  // IPv6: expand "::" then read 8 groups of 16 bits.
  let expanded = addr;
  if (expanded.includes('::')) {
    const [head, tail] = expanded.split('::');
    const headGroups = head ? head.split(':') : [];
    const tailGroups = tail ? tail.split(':') : [];
    const missing = 8 - headGroups.length - tailGroups.length;
    expanded = [...headGroups, ...Array(missing).fill('0'), ...tailGroups].join(':');
  }
  const groups = expanded.split(':');
  if (groups.length !== 8) throw new Error(`invalid_ipv6:${addr}`);
  let out = 0n;
  for (const g of groups) {
    const n = parseInt(g || '0', 16);
    if (Number.isNaN(n) || n < 0 || n > 0xffff) throw new Error(`invalid_ipv6:${addr}`);
    out = (out << 16n) | BigInt(n);
  }
  return out;
}
