import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import IORedis from 'ioredis';

let _client;
function getClient(url) {
  if (_client) return _client;
  _client = new IORedis(url, { enableOfflineQueue: false });
  return _client;
}

export function buildLimiter({
  redisUrl,
  prefix,
  windowMs,
  max,
  keyGenerator,
  message = 'Too many requests',
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => {
      res.status(429).type('application/problem+json').json({
        type: 'https://pinebank.com/errors/rate_limited',
        title: message,
        status: 429,
        code: 'rate_limited',
      });
    },
    store: new RedisStore({
      sendCommand: (...args) => getClient(redisUrl).call(...args),
      prefix: `pine:rl:${prefix}:`,
    }),
  });
}

export function globalIpLimiter(redisUrl) {
  return buildLimiter({
    redisUrl,
    prefix: 'global',
    windowMs: 60_000,
    max: 600,
    keyGenerator: (req) => req.ip,
  });
}

export function loginLimiter(redisUrl) {
  return buildLimiter({
    redisUrl,
    prefix: 'login',
    windowMs: 60_000,
    max: 5,
    keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
    message: 'Too many login attempts',
  });
}

export function transferLimiter(redisUrl) {
  return buildLimiter({
    redisUrl,
    prefix: 'transfer',
    windowMs: 60_000,
    max: 20,
    keyGenerator: (req) => (req.user && req.user.id) || req.ip,
    message: 'Too many transfer attempts',
  });
}

export function pinAttemptLimiter(redisUrl) {
  return buildLimiter({
    redisUrl,
    prefix: 'pin',
    windowMs: 60 * 60_000,
    max: 10,
    keyGenerator: (req) => (req.user && req.user.id) || req.ip,
    message: 'Too many PIN attempts',
  });
}
