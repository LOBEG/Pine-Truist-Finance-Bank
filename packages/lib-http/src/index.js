import helmet from 'helmet';
import cors from 'cors';

// --------------------- Application Errors ---------------------

export class AppError extends Error {
  constructor(status, code, message, { detail, cause } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    if (cause) this.cause = cause;
  }
}

export const errors = {
  badRequest: (code, message, detail) => new AppError(400, code, message, { detail }),
  unauthorized: (code = 'unauthorized', message = 'Authentication required.') =>
    new AppError(401, code, message),
  forbidden: (code = 'forbidden', message = 'Access denied.') => new AppError(403, code, message),
  notFound: (code = 'not_found', message = 'Resource not found.') =>
    new AppError(404, code, message),
  conflict: (code, message, detail) => new AppError(409, code, message, { detail }),
  tooMany: (code = 'rate_limited', message = 'Too many requests.') =>
    new AppError(429, code, message),
  internal: (message = 'Internal server error.') => new AppError(500, 'internal_error', message),
};

// --------------------- Middleware: security headers ---------------------

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'img-src': ["'self'", 'data:'],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'connect-src': ["'self'", 'https:', 'wss:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  });
}

// --------------------- Middleware: CORS ---------------------

export function corsMiddleware(originsCsv) {
  const allowed = (originsCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // same-origin / curl
      if (allowed.length === 0) return cb(null, false);
      return cb(null, allowed.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
}

// --------------------- Middleware: async wrapper ---------------------

/** Catches rejected promises from async route handlers and forwards to next(). */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// --------------------- Middleware: zod validator ---------------------

export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      next(
        new AppError(400, 'validation_error', 'Request validation failed.', {
          detail: err.issues || err.message,
        }),
      );
    }
  };
}

// --------------------- Middleware: RFC 7807 error handler ---------------------

export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const status = err.status || 500;
    const body = {
      type: `https://pinebank.com/errors/${err.code || 'internal_error'}`,
      title: err.message || 'Internal Server Error',
      status,
      code: err.code || 'internal_error',
      detail: err.detail,
      traceId: req.id,
    };
    if (status >= 500) {
      logger.error(
        { err, req: { id: req.id, method: req.method, url: req.url } },
        'unhandled error',
      );
    } else {
      logger.warn({ code: body.code, status, traceId: req.id }, body.title);
    }
    res.status(status).type('application/problem+json').json(body);
  };
}

// --------------------- 404 ---------------------

export function notFoundHandler() {
  return (req, _res, next) =>
    next(errors.notFound('route_not_found', `No route ${req.method} ${req.path}`));
}

// --------------------- Healthchecks ---------------------

export function healthRoutes(app, checks = {}) {
  app.get('/healthz', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
  app.get('/readyz', async (_req, res) => {
    const results = {};
    let ok = true;
    for (const [name, fn] of Object.entries(checks)) {
      try {
        await fn();
        results[name] = 'ok';
      } catch (err) {
        ok = false;
        results[name] = err.message;
      }
    }
    res.status(ok ? 200 : 503).json({ ok, checks: results });
  });
}
