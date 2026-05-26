import { RateLimiterPostgres } from 'rate-limiter-flexible';
import { getPool } from '@pine/lib-db';

/**
 * Per-IP global rate limiter for the admin API. Defence-in-depth on top of
 * the Cloudflare WAF + IP allowlist; protects authorization-bearing handlers
 * from brute-force / scraping by authenticated admin sessions.
 *
 * Uses Postgres instead of Redis for rate limiting via the rate_limits table.
 * This removes the Redis dependency while maintaining distributed rate limiting.
 */
let _adminLimiter = null;

function getLimiter() {
  if (_adminLimiter) return _adminLimiter;

  _adminLimiter = new RateLimiterPostgres({
    storeClient: getPool(),
    tableName: 'rate_limits',
    points: 300, // 300 requests
    duration: 60, // per 60 seconds
    keyPrefix: 'admin_global',
    tableCreated: true, // table created by migration 0006
  });

  return _adminLimiter;
}

export function adminGlobalLimiter() {
  return async (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';

    try {
      await getLimiter().consume(key, 1);
      next();
    } catch (err) {
      if (err instanceof Error) {
        // Actual error (not rate limit exceeded)
        next(err);
        return;
      }

      // Rate limit exceeded — err is RateLimiterRes
      const retryAfter = Math.ceil(err.msBeforeNext / 1000);
      res
        .set('Retry-After', String(retryAfter))
        .set('X-RateLimit-Limit', '300')
        .set('X-RateLimit-Remaining', '0')
        .set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + retryAfter))
        .status(429)
        .type('application/problem+json')
        .json({
          type: 'https://pinebank.com/errors/rate_limited',
          title: 'Too many admin requests',
          status: 429,
          code: 'rate_limited',
          retryAfter,
        });
    }
  };
}
