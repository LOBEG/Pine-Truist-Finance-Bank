import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RateLimiterPostgres } from 'rate-limiter-flexible';
import { loadConfig } from '@pine/lib-config';
import { createLogger, httpLogger } from '@pine/lib-logger';
import { createPool, getPool, query } from '@pine/lib-db';
import {
  securityHeaders,
  corsMiddleware,
  errorHandler,
  notFoundHandler,
  healthRoutes,
} from '@pine/lib-http';

const config = loadConfig({ serviceName: 'api-gateway' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});

// Initialize Postgres pool for rate limiting
createPool({ url: config.database.url, ssl: config.database.ssl });

const app = express();
app.disable('x-powered-by');
if (config.security.trustProxy) app.set('trust proxy', 1);

app.use(securityHeaders());
app.use(corsMiddleware(config.cors.origins));
app.use(httpLogger(logger));

healthRoutes(app, {
  db: async () => {
    await query('SELECT 1');
  },
});

// Postgres-native rate limiter (no Redis)
let _limiter = null;
function getLimiter() {
  if (_limiter) return _limiter;

  _limiter = new RateLimiterPostgres({
    storeClient: getPool(),
    tableName: 'rate_limits',
    points: 600, // 600 requests
    duration: 60, // per 60 seconds
    keyPrefix: 'gateway_global',
    tableCreated: true, // table created by migration 0006
  });

  return _limiter;
}

async function globalLimiter(req, res, next) {
  const key = req.ip || req.connection?.remoteAddress || 'unknown';

  try {
    await getLimiter().consume(key, 1);
    next();
  } catch (err) {
    if (err instanceof Error) {
      logger.warn({ err: err.message }, 'gateway rate limiter unavailable; failing open');
      next();
      return;
    }

    const retryAfter = Math.ceil(err.msBeforeNext / 1000);
    res
      .set('Retry-After', String(retryAfter))
      .set('X-RateLimit-Limit', '600')
      .set('X-RateLimit-Remaining', '0')
      .set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + retryAfter))
      .status(429)
      .type('application/problem+json')
      .json({
        type: 'https://pinebank.com/errors/rate_limited',
        title: 'Too many requests',
        status: 429,
        code: 'rate_limited',
        retryAfter,
      });
  }
}

app.use(globalLimiter);

const CORE_URL = config.internal.coreBankingUrl;
const ADMIN_URL = config.internal.adminApiUrl;
if (!CORE_URL) throw new Error('CORE_BANKING_URL not configured');

// Strip trailing slashes and forward through.
const commonProxyOpts = {
  changeOrigin: true,
  xfwd: true,
  proxyTimeout: 25_000,
  timeout: 30_000,
  on: {
    error: (err, req, res) => {
      logger.error({ err: err.message, path: req.path }, 'proxy error');
      if (!res.headersSent) {
        res.status(502).type('application/problem+json').json({
          type: 'https://pinebank.com/errors/bad_gateway',
          title: 'Upstream service unavailable',
          status: 502,
          code: 'bad_gateway',
        });
      }
    },
  },
};

app.use(
  '/api/v1/admin',
  createProxyMiddleware({ target: ADMIN_URL || CORE_URL, ...commonProxyOpts }),
);
app.use('/api/v1', createProxyMiddleware({ target: CORE_URL, ...commonProxyOpts }));

app.use(notFoundHandler());
app.use(errorHandler(logger));

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, coreUpstream: CORE_URL, adminUpstream: ADMIN_URL },
    'api-gateway listening',
  );
});

async function gracefulShutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
