import crypto from 'node:crypto';

/**
 * Stateless double-submit CSRF protection middleware.
 *
 * How it works:
 *  1. On every response the server sets a `__Host-csrf` cookie with a random token.
 *  2. The client reads that cookie and echoes it back in an `X-CSRF-Token` header.
 *  3. State-changing requests (POST/PUT/PATCH/DELETE) are rejected unless
 *     the header matches the cookie.
 *
 * Why this is secure:
 *  - The `__Host-` prefix ensures Secure + same-origin + path=/ (no subdomain leak).
 *  - Cross-site attackers cannot read the cookie due to SameSite=Strict.
 *  - A matching header proves the request was initiated by JS on the same origin.
 *
 * Usage:
 *   app.use(csrfProtection());
 *   // All state-changing routes behind this middleware are now CSRF-protected.
 */
export function csrfProtection({ cookieName = '__Host-csrf', headerName = 'x-csrf-token' } = {}) {
  return (req, res, next) => {
    // Always issue / refresh the CSRF token cookie.
    const existingToken = parseCookie(req.headers.cookie, cookieName);
    const token = existingToken || crypto.randomBytes(32).toString('base64url');
    if (!existingToken) {
      // NOTE: the cookie deliberately omits `HttpOnly`. The double-submit
      // pattern requires client JS to read this token and echo it back in the
      // `X-CSRF-Token` header. Browsers treat the mere *presence* of the
      // `HttpOnly` attribute as enabled (the `=false` value is ignored), which
      // would make the cookie unreadable by JS and cause every state-changing
      // request to fail CSRF validation with 403.
      res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; Secure; SameSite=Strict`);
    }

    // Safe methods don't need validation.
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    // Validate: header must match cookie.
    const headerVal = req.headers[headerName];
    if (!headerVal || !existingToken || !constantTimeEquals(headerVal, existingToken)) {
      return res.status(403).type('application/problem+json').json({
        type: 'https://pinebank.com/errors/csrf_invalid',
        title: 'CSRF validation failed',
        status: 403,
        code: 'csrf_invalid',
        detail: 'Missing or mismatched CSRF token.',
      });
    }
    next();
  };
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escapeRe(name)}=([^;]+)`));
  return match ? match[1] : null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function constantTimeEquals(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
