/**
 * Rate limiting middleware using Postgres (no Redis required).
 *
 * Uses rate-limiter-flexible with PostgresStoreAdapter for durable,
 * horizontally-scalable rate limiting backed by the same Postgres DB.
 */
import { RateLimiterPostgres } from 'rate-limiter-flexible';
import { getPool } from '@pine/lib-db';

// Shared rate limiter instances (created lazily)
const limiters = new Map();

async function getPostgresLimiter({ keyPrefix, points, duration }) {
  const key = `${keyPrefix}:${points}:${duration}`;
  if (limiters.has(key)) return limiters.get(key);

  const limiter = new RateLimiterPostgres({
    storeClient: getPool(),
    tableName: 'rate_limits',
    keyPrefix,
    points,
    duration,
    // Postgres-specific options
    tableCreated: true, // Table created by migration
    clearExpiredByTimeout: false, // Scheduler handles cleanup
  });

  // Wait for table check to complete
  await limiter.ready;
  limiters.set(key, limiter);
  return limiter;
}

export function buildLimiter({
  prefix,
  windowMs,
  max,
  keyGenerator,
  message = 'Too many requests',
}) {
  // Convert windowMs to seconds for rate-limiter-flexible
  const duration = Math.ceil(windowMs / 1000);

  return async (req, res, next) => {
    try {
      const limiter = await getPostgresLimiter({
        keyPrefix: `pine:rl:${prefix}`,
        points: max,
        duration,
      });

      const key = keyGenerator(req);
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      if (rejRes instanceof Error) {
        // Database error, fail open
        console.error('[ratelimit] Database error:', rejRes.message);
        next();
        return;
      }
      // Rate limit exceeded
      res
        .status(429)
        .type('application/problem+json')
        .json({
          type: 'https://pinebank.com/errors/rate_limited',
          title: message,
          status: 429,
          code: 'rate_limited',
          retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
        });
    }
  };
}

export function globalIpLimiter() {
  return buildLimiter({
    prefix: 'global',
    windowMs: 60_000,
    max: 600,
    keyGenerator: (req) => req.ip || 'unknown',
  });
}

export function loginLimiter() {
  return buildLimiter({
    prefix: 'login',
    windowMs: 60_000,
    max: 5,
    keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
    message: 'Too many login attempts',
  });
}

export function transferLimiter() {
  return buildLimiter({
    prefix: 'transfer',
    windowMs: 60_000,
    max: 20,
    keyGenerator: (req) => (req.user && req.user.id) || req.ip || 'unknown',
    message: 'Too many transfer attempts',
  });
}

export function pinAttemptLimiter() {
  return buildLimiter({
    prefix: 'pin',
    windowMs: 60 * 60_000,
    max: 10,
    keyGenerator: (req) => (req.user && req.user.id) || req.ip || 'unknown',
    message: 'Too many PIN attempts',
  });
}

export function registerLimiter() {
  return buildLimiter({
    prefix: 'register',
    windowMs: 60 * 60_000, // 1 hour
    max: 5,
    keyGenerator: (req) => req.ip || 'unknown',
    message: 'Too many registration attempts',
  });
}

export function mfaLimiter() {
  return buildLimiter({
    prefix: 'mfa',
    windowMs: 60_000, // 1 minute
    max: 10,
    keyGenerator: (req) => (req.user && req.user.id) || req.ip || 'unknown',
    message: 'Too many MFA attempts',
  });
}

export function authenticatedLimiter() {
  return buildLimiter({
    prefix: 'authed',
    windowMs: 60_000, // 1 minute
    max: 100,
    keyGenerator: (req) => (req.user && req.user.id) || req.ip || 'unknown',
    message: 'Too many requests',
  });
}
