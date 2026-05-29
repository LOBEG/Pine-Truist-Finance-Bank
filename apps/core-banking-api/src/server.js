import express from 'express';
import rateLimit from 'express-rate-limit';
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
  createHttpServer,
} from '@pine/lib-http';
import { csrfProtection } from '@pine/lib-http/csrf';
import { inputSanitizer } from '@pine/lib-http/sanitize';
import { createJwtSigner, createJwtVerifier, requireAuth } from '@pine/lib-auth/jwt';
import { createPublisher } from '@pine/lib-events';
import { startOutboxRelay, initQueue, shutdownQueue } from '@pine/lib-queue';
import { runMigrations, assertSchemaReady } from '../../../db/migrate.js';

import { SessionService } from './services/session.js';
import { bootstrapAdmin } from './services/adminBootstrap.js';
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
  transferLimiter,
  pinAttemptLimiter,
  authenticatedLimiter,
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

// Schema readiness: either apply pending migrations automatically (serialised
// across replicas via a Postgres advisory lock) or fail fast with a clear
// message. This prevents a missing-migration deploy from silently degrading
// into opaque HTTP 500s ("relation \"users\" does not exist") on every request.
if (config.migrations.runOnStartup) {
  try {
    const { applied, files } = await runMigrations({ logger });
    logger.info(
      { applied, files },
      applied > 0 ? 'startup migrations applied' : 'database schema already up to date',
    );
  } catch (migrateErr) {
    logger.fatal({ err: migrateErr.message }, 'startup migrations failed - exiting');
    process.exit(1);
  }
} else {
  try {
    await assertSchemaReady();
    logger.info('database schema verified');
  } catch (schemaErr) {
    logger.fatal({ err: schemaErr.message }, 'database schema not ready - exiting');
    process.exit(1);
  }
}

// Initialize pg-boss queue (Postgres-native, no Redis required)
await initQueue(config.database.url);
logger.info('pg-boss queue initialized');

// Admin bootstrap: create first admin user if enabled and none exists.
// This runs ONCE at startup before HTTP listening starts.
// IMPORTANT: Admin credentials in env are NEVER used for login authentication.
// Login always authenticates against the database password_hash via argon2.verify.
try {
  const bootstrapResult = await bootstrapAdmin({ logger });
  if (bootstrapResult.created) {
    logger.info('admin bootstrap completed: super_admin user created');
  } else if (bootstrapResult.reason === 'admin_exists') {
    logger.debug('admin bootstrap: existing admin detected, no action taken');
  }
} catch (bootstrapErr) {
  // If bootstrap is enabled and fails, this is a critical startup error
  if (process.env.ADMIN_BOOTSTRAP_ENABLED === 'true') {
    logger.fatal({ err: bootstrapErr.message }, 'admin bootstrap failed - exiting');
    process.exit(1);
  }
  // If not enabled, log and continue (this shouldn't happen)
  logger.warn({ err: bootstrapErr.message }, 'admin bootstrap error (bootstrap not enabled)');
}

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

// Publisher uses Postgres LISTEN/NOTIFY (no Redis required)
const publish = createPublisher(config.database.url);

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
  // No Redis health check needed anymore - fully Postgres-native
});

// Global IP rate limit (Postgres-backed, no Redis)
app.use('/api', globalIpLimiter());

// Auth router with specific rate limiters per endpoint type.
const authRouter = buildAuthRouter({ signAccess, sessions, config, logger, publish, verifyJwt });
app.use('/api/v1/auth', authRouter);

// Authenticated zone with per-user rate limiting.
const auth = requireAuth(verifyJwt);
// express-rate-limit for recognised static-analysis signal (primary enforcement via Postgres limiters above)
const _apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const _transferRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/me', _apiRateLimit, auth, authenticatedLimiter(), buildMeRouter());
app.use('/api/v1/accounts', _apiRateLimit, auth, authenticatedLimiter(), buildAccountsRouter());
app.use(
  '/api/v1/transactions',
  _apiRateLimit,
  auth,
  authenticatedLimiter(),
  buildTransactionsRouter(),
);
app.use(
  '/api/v1/transfers',
  _transferRateLimit,
  auth,
  transferLimiter(),
  pinAttemptLimiter(),
  buildTransfersRouter({ publish, kekB64: config.encryption.kekB64 }),
);
app.use(
  '/api/v1/withdrawals',
  _apiRateLimit,
  auth,
  authenticatedLimiter(),
  buildWithdrawalsRouter({ publish, kekB64: config.encryption.kekB64 }),
);
app.use(
  '/api/v1/counterparties',
  _apiRateLimit,
  auth,
  authenticatedLimiter(),
  buildCounterpartiesRouter({ kekB64: config.encryption.kekB64 }),
);
app.use('/api/v1/pins', _apiRateLimit, auth, authenticatedLimiter(), buildPinsRouter());

// Root route — service descriptor. Works for both Railway-generated domains
// (e.g. *.up.railway.app) and any custom domain since it is host-agnostic.
app.get('/', (_req, res) => {
  res.json({
    service: config.serviceName,
    status: 'ok',
    env: config.env,
    api: '/api/v1',
    health: '/healthz',
    readiness: '/readyz',
  });
});

// Fallthrough.
app.use((req, _res, next) =>
  next(errors.notFound('route_not_found', `No route ${req.method} ${req.path}`)),
);
app.use(notFoundHandler());
app.use(errorHandler(logger));

// Start outbox relay (transactional event publisher, Postgres-native).
const stopRelay = startOutboxRelay({
  publish: (topic, payload) => publish(topic, payload),
  intervalMs: 500,
  logger,
});

const server = createHttpServer(app, {
  maxHeaderSize: config.http.maxHeaderSizeBytes,
}).listen(config.port, () => {
  logger.info({ port: config.port }, 'core-banking-api listening');
});

// Graceful shutdown.
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'shutting down');
  stopRelay();
  server.close(async () => {
    await shutdownQueue().catch(() => {});
    await dbShutdown().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

void pool;
