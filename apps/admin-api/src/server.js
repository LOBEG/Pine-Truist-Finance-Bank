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
import { createJwtVerifier, requireAuth } from '@pine/lib-auth/jwt';
import { requireRole, requireMfa } from '@pine/lib-auth/rbac';
import { csrfProtection } from '@pine/lib-http/csrf';
import { createPublisher } from '@pine/lib-events';
import { initQueue, startOutboxRelay } from '@pine/lib-queue';

import { adminGlobalLimiter } from './middleware/ratelimit.js';
import { ipAllowlist } from './middleware/ipAllowlist.js';
import { buildUsersRouter } from './routes/users.js';
import { buildPinsRouter } from './routes/pins.js';
import { buildWithdrawalsRouter } from './routes/withdrawals.js';
import { buildTransactionsRouter } from './routes/transactions.js';
import { buildComplianceRouter } from './routes/compliance.js';
import { buildAuditRouter } from './routes/audit.js';
import { buildSettingsRouter } from './routes/settings.js';

const config = loadConfig({ serviceName: 'admin-api' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});

createPool({
  url: config.database.url,
  ssl: config.database.ssl,
  poolMin: config.database.poolMin,
  poolMax: config.database.poolMax,
});

// Initialize pg-boss job queue (Postgres-native, no Redis)
await initQueue(config.database.url);

const verifyJwt = createJwtVerifier({
  publicKeyB64: config.jwt.publicKeyB64,
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
});

// Postgres LISTEN/NOTIFY pub/sub (no Redis)
const publish = createPublisher(config.database.url);

const app = express();
app.disable('x-powered-by');
if (config.security.trustProxy) app.set('trust proxy', 1);
app.use(securityHeaders());
app.use(corsMiddleware(config.cors.origins));
app.use(express.json({ limit: '256kb' }));
app.use(httpLogger(logger));
app.use(ipAllowlist(config.security.adminIpAllowlist));

healthRoutes(app, {
  db: async () => {
    await query('SELECT 1');
  },
  // No Redis health check — all infrastructure is Postgres-native
});

const auth = requireAuth(verifyJwt);
// All admin endpoints require non-customer role.
const adminOnly = requireRole('admin', 'super_admin', 'compliance_officer', 'auditor', 'support');
// MFA step-up is mandatory for every admin endpoint — privileged actions
// (PIN issuance, withdrawal approval, transaction release/reversal) must
// not be reachable with a bare password+refresh session. The JWT signer
// sets the `mfa` claim only after a successful MFA verification.
const mfaRequired = requireMfa();
// Double-submit CSRF protection for browser-originated admin requests.
const adminCsrf = csrfProtection();

app.use(
  '/api/v1/admin',
  adminGlobalLimiter(), // No Redis URL — uses Postgres via rate-limiter-flexible
  auth,
  adminOnly,
  mfaRequired,
  adminCsrf,
);
app.use('/api/v1/admin/users', buildUsersRouter());
app.use('/api/v1/admin/users', buildPinsRouter({ publish })); // POST /:userId/pins
app.use(
  '/api/v1/admin/withdrawals',
  buildWithdrawalsRouter({ publish, kekB64: config.encryption.kekB64 }),
);
app.use('/api/v1/admin/transactions', buildTransactionsRouter({ publish }));
app.use('/api/v1/admin/compliance', buildComplianceRouter());
app.use('/api/v1/admin/audit', buildAuditRouter());
app.use('/api/v1/admin/settings', buildSettingsRouter());

app.use((req, _res, next) =>
  next(errors.notFound('route_not_found', `No route ${req.method} ${req.path}`)),
);
app.use(notFoundHandler());
app.use(errorHandler(logger));

const stopRelay = startOutboxRelay({ publish, intervalMs: 500, logger });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'admin-api listening');
});

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
