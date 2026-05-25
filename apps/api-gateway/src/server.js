import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import IORedis from 'ioredis';
import { loadConfig } from '@pine/lib-config';
import { createLogger, httpLogger } from '@pine/lib-logger';
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

const redisClient = new IORedis(config.redis.url, { enableOfflineQueue: false });

const app = express();
app.disable('x-powered-by');
if (config.security.trustProxy) app.set('trust proxy', 1);

app.use(securityHeaders());
app.use(corsMiddleware(config.cors.origins));
app.use(httpLogger(logger));

healthRoutes(app, {
  redis: async () => {
    await redisClient.ping();
  },
});

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'pine:rl:gw:',
  }),
});
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
    redisClient.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
