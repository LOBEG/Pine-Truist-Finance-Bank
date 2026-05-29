import pino from 'pino';
import pinoHttp from 'pino-http';
import { nanoid } from 'nanoid';

const SENSITIVE_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.body.password',
  'req.body.pin',
  'req.body.mfaCode',
  'req.body.refreshToken',
  'req.body.ssn',
  'req.body.accountNumber',
  'res.headers["set-cookie"]',
  '*.password',
  '*.pin',
  '*.ssn',
  '*.privateKey',
  '*.secret',
  '*.token',
];

export function createLogger({ serviceName, level = 'info', env = 'development' } = {}) {
  return pino({
    name: serviceName,
    level,
    base: { service: serviceName, env },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: SENSITIVE_PATHS,
      remove: false,
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}

/**
 * Express middleware that adds `req.id` and `req.log` and emits one access log per request.
 */
export function httpLogger(logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = incoming || nanoid(16);
      res.setHeader('x-request-id', id);
      return id;
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} ${err?.message ?? ''}`,
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}

export { nanoid };
