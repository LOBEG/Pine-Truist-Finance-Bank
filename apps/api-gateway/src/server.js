import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RateLimiterPostgres } from 'rate-limiter-flexible';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '@pine/lib-config';
import { createLogger, httpLogger } from '@pine/lib-logger';
import { createPool, getPool, query } from '@pine/lib-db';
import {
  securityHeaders,
  corsMiddleware,
  errorHandler,
  notFoundHandler,
  healthRoutes,
  createHttpServer,
} from '@pine/lib-http';

const config = loadConfig({ serviceName: 'api-gateway' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});

// Initialize Postgres pool for rate limiting
createPool({ url: config.database.url, ssl: config.database.ssl });

// ---------------------------------------------------------------------------
// Resolve the built web SPA directory (single-origin deployment).
//
// When the api-gateway can find a built SPA (apps/web/dist), it serves the UI
// on the SAME origin as /api/v1. The browser then calls /api/v1 relative to
// its own origin, so requests never traverse Railway private networking and
// there is no PINE_BACKEND_URL / internal-DNS proxy to misconfigure.
//
// Resolution order:
//   1. WEB_STATIC_DIR env (explicit override)
//   2. bundled default: <repo>/apps/web/dist (relative to this file)
// Static serving is enabled only when the resolved directory contains an
// index.html; otherwise the gateway runs in pure-proxy mode (web served by a
// separate service).
// ---------------------------------------------------------------------------
function resolveWebStaticDir() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidate =
    config.web.staticDir && config.web.staticDir.trim()
      ? path.resolve(config.web.staticDir.trim())
      : path.resolve(__dirname, '../../web/dist');
  try {
    if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
  } catch {
    // fall through to disabled
  }
  return null;
}

const WEB_STATIC_DIR = resolveWebStaticDir();

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

// Serve static SPA assets (JS/CSS/images) BEFORE the global rate limiter so a
// single asset-heavy page load does not consume the API request budget. This
// never matches /api/v1 paths, which are handled by the proxies below.
if (WEB_STATIC_DIR) {
  app.use(
    express.static(WEB_STATIC_DIR, {
      index: false, // index.html is handled by the SPA fallback below
      maxAge: '1h',
    }),
  );
}

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

// NOTE: use `pathFilter` (not Express path-mounting) so the matched prefix is
// preserved when forwarding. With http-proxy-middleware v3, mounting via
// `app.use('/api/v1', proxy)` makes Express strip `/api/v1` from req.url before
// the proxy runs, so the upstream would receive `/auth/login` instead of
// `/api/v1/auth/login` and 404 ("No route POST /auth/login"). Mounting at the
// app root with `pathFilter` keeps the full original path intact. The admin
// proxy is registered first so admin paths are handled before the catch-all.
app.use(
  createProxyMiddleware({
    pathFilter: '/api/v1/admin',
    target: ADMIN_URL || CORE_URL,
    ...commonProxyOpts,
  }),
);
app.use(createProxyMiddleware({ pathFilter: '/api/v1', target: CORE_URL, ...commonProxyOpts }));

// SPA fallback: any non-API request that did not match a static asset returns
// index.html so client-side routing (React Router) works on hard reloads and
// deep links. Registered AFTER the API proxies so /api/* never falls through.
if (WEB_STATIC_DIR) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(WEB_STATIC_DIR, 'index.html'));
  });
}

app.use(notFoundHandler());
app.use(errorHandler(logger));

const server = createHttpServer(app, {
  maxHeaderSize: config.http.maxHeaderSizeBytes,
}).listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      coreUpstream: CORE_URL,
      adminUpstream: ADMIN_URL,
      webStaticDir: WEB_STATIC_DIR || null,
      mode: WEB_STATIC_DIR ? 'single-origin (SPA + API)' : 'proxy-only (no SPA)',
    },
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
