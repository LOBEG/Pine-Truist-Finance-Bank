import express from 'express';
import { loadConfig } from '@pine/lib-config';
import { createLogger, httpLogger } from '@pine/lib-logger';
import { createPool, query, shutdown as dbShutdown } from '@pine/lib-db';
import {
  securityHeaders,
  corsMiddleware,
  errorHandler,
  notFoundHandler,
  healthRoutes,
  errors,
} from '@pine/lib-http';
import { csrfProtection } from '@pine/lib-http/csrf';
import { inputSanitizer } from '@pine/lib-http/sanitize';
import { createJwtSigner, createJwtVerifier, requireAuth } from '@pine/lib-auth/jwt';
import { createPublisher } from '@pine/lib-events';
import { startOutboxRelay, getRedisConnection } from '@pine/lib-queue';

import { SessionService } from './services/session.js';
import { buildAuthRouter } from './routes/auth.js';
import { buildAccountsRouter } from './routes/accounts.js';
import { buildTransactionsRouter } from './routes/transactions.js';
import { buildTransfersRouter } from './routes/transfers.js';
import { buildWithdrawalsRouter } from './routes/withdrawals.js';
import { buildCounterpartiesRouter } from './routes/counterparties.js';
import { buildPinsRouter } from './routes/pins.js';
import { buildMeRouter } from './routes/me.js';
import {
  globalIpLimiter,
  loginLimiter,
  transferLimiter,
  pinAttemptLimiter,
} from './middleware/ratelimit.js';

const config = loadConfig({ serviceName: 'core-banking-api' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});

const pool = createPool({
  url: config.database.url,
  ssl: config.database.ssl,
  poolMin: config.database.poolMin,
  poolMax: config.database.poolMax,
});
logger.info({ poolMax: config.database.poolMax }, 'db pool initialized');

const signAccess = createJwtSigner({
  privateKeyB64: config.jwt.privateKeyB64,
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
  accessTtlSeconds: config.jwt.accessTtlSeconds,
});
const verifyJwt = createJwtVerifier({
  publicKeyB64: config.jwt.publicKeyB64,
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
});

const sessions = new SessionService({
  refreshTokenPepper: config.encryption.refreshTokenPepper,
  refreshTtlSeconds: config.jwt.refreshTtlSeconds,
});

const publish = createPublisher(config.redis.url);

const app = express();
app.disable('x-powered-by');
if (config.security.trustProxy) app.set('trust proxy', 1);

app.use(securityHeaders());
app.use(corsMiddleware(config.cors.origins));
app.use(express.json({ limit: '256kb' }));
app.use(inputSanitizer());
app.use(httpLogger(logger));

// CSRF protection — skip for auth routes that use refresh tokens (stateless token exchange).
app.use('/api/v1/accounts', csrfProtection());
app.use('/api/v1/transfers', csrfProtection());
app.use('/api/v1/withdrawals', csrfProtection());
app.use('/api/v1/counterparties', csrfProtection());
app.use('/api/v1/pins', csrfProtection());

healthRoutes(app, {
  db: async () => {
    await query('SELECT 1');
  },
  redis: async () => {
    await getRedisConnection(config.redis.url).ping();
  },
});

// Global IP rate limit.
app.use('/api', globalIpLimiter(config.redis.url));

// Auth router with login-specific limiter on /login.
const authRouter = buildAuthRouter({ signAccess, sessions, config, logger, publish, verifyJwt });
app.use('/api/v1/auth/login', loginLimiter(config.redis.url));
app.use('/api/v1/auth', authRouter);

// Authenticated zone.
const auth = requireAuth(verifyJwt);

app.use('/api/v1/me', auth, buildMeRouter());
app.use('/api/v1/accounts', auth, buildAccountsRouter());
app.use('/api/v1/transactions', auth, buildTransactionsRouter());
app.use(
  '/api/v1/transfers',
  auth,
  transferLimiter(config.redis.url),
  pinAttemptLimiter(config.redis.url),
  buildTransfersRouter({ publish, kekB64: config.encryption.kekB64 }),
);
app.use(
  '/api/v1/withdrawals',
  auth,
  buildWithdrawalsRouter({ publish, kekB64: config.encryption.kekB64 }),
);
app.use(
  '/api/v1/counterparties',
  auth,
  buildCounterpartiesRouter({ kekB64: config.encryption.kekB64 }),
);
app.use('/api/v1/pins', auth, buildPinsRouter());

// Fallthrough.
app.use((req, _res, next) =>
  next(errors.notFound('route_not_found', `No route ${req.method} ${req.path}`)),
);
app.use(notFoundHandler());
app.use(errorHandler(logger));

// Start outbox relay (transactional event publisher).
const stopRelay = startOutboxRelay({
  publish: (topic, payload) => publish(topic, payload),
  intervalMs: 500,
  logger,
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'core-banking-api listening');
});

// Graceful shutdown.
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'shutting down');
  stopRelay();
  server.close(async () => {
    await dbShutdown().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

void pool;
