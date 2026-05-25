import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import IORedis from 'ioredis';

let _client;
function getClient(url) {
  if (_client) return _client;
  _client = new IORedis(url, { enableOfflineQueue: false });
  return _client;
}

/**
 * Per-IP global rate limiter for the admin API. Defence-in-depth on top of
 * the Cloudflare WAF + IP allowlist; protects authorization-bearing handlers
 * from brute-force / scraping by authenticated admin sessions.
 */
export function adminGlobalLimiter(redisUrl) {
  return rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({ sendCommand: (...args) => getClient(redisUrl).call(...args) }),
    handler: (_req, res) => {
      res.status(429).type('application/problem+json').json({
        type: 'https://pinebank.com/errors/rate_limited',
        title: 'Too many admin requests',
        status: 429,
        code: 'rate_limited',
      });
    },
  });
}
