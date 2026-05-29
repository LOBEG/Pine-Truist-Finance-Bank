import convict from 'convict';

/**
 * Build a strongly-validated configuration object for a service.
 * Throws synchronously at boot if required values are missing or malformed.
 *
 * @param {object} options
 * @param {string} options.serviceName - Logical service name (e.g. 'core-banking-api').
 * @param {object} [options.extraSchema] - Additional convict schema fragments specific to the service.
 * @returns {object} Plain object of resolved config values.
 */
export function loadConfig({ serviceName, extraSchema = {} }) {
  const schema = {
    env: {
      doc: 'Application environment.',
      format: ['production', 'staging', 'development', 'test'],
      default: 'development',
      env: 'NODE_ENV',
    },
    serviceName: {
      doc: 'Service identifier used in logs and traces.',
      format: String,
      default: serviceName,
      env: 'SERVICE_NAME',
    },
    port: {
      doc: 'HTTP port for the service.',
      format: 'port',
      default: 8080,
      env: 'PORT',
    },
    logLevel: {
      doc: 'Pino log level.',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL',
    },
    database: {
      url: {
        doc: 'PostgreSQL connection URL.',
        format: String,
        default: '',
        env: 'DATABASE_URL',
        sensitive: true,
      },
      ssl: {
        doc: 'TLS mode (require/disable/no-verify).',
        format: ['require', 'disable', 'no-verify'],
        default: 'require',
        env: 'DATABASE_SSL',
      },
      poolMin: { format: 'nat', default: 2, env: 'DATABASE_POOL_MIN' },
      poolMax: { format: 'nat', default: 20, env: 'DATABASE_POOL_MAX' },
    },
    redis: {
      url: {
        doc: 'Redis connection URL.',
        format: String,
        default: '',
        env: 'REDIS_URL',
        sensitive: true,
      },
    },
    jwt: {
      privateKeyB64: { format: String, default: '', env: 'JWT_PRIVATE_KEY_B64', sensitive: true },
      publicKeyB64: { format: String, default: '', env: 'JWT_PUBLIC_KEY_B64', sensitive: true },
      issuer: { format: String, default: 'pine-bank', env: 'JWT_ISSUER' },
      audience: { format: String, default: 'pine-bank-clients', env: 'JWT_AUDIENCE' },
      accessTtlSeconds: { format: 'nat', default: 600, env: 'JWT_ACCESS_TTL_SECONDS' },
      refreshTtlSeconds: { format: 'nat', default: 2592000, env: 'JWT_REFRESH_TTL_SECONDS' },
    },
    encryption: {
      kekB64: { format: String, default: '', env: 'ENCRYPTION_KEK_B64', sensitive: true },
      refreshTokenPepper: {
        format: String,
        default: '',
        env: 'REFRESH_TOKEN_PEPPER',
        sensitive: true,
      },
    },
    cors: {
      origins: {
        doc: 'Comma-separated list of allowed CORS origins.',
        format: String,
        default: '',
        env: 'CORS_ORIGINS',
      },
    },
    email: {
      postmarkToken: { format: String, default: '', env: 'POSTMARK_TOKEN', sensitive: true },
      from: { format: String, default: 'Pine Bank <no-reply@pinebank.com>', env: 'EMAIL_FROM' },
    },
    sms: {
      twilioSid: { format: String, default: '', env: 'TWILIO_ACCOUNT_SID', sensitive: true },
      twilioToken: { format: String, default: '', env: 'TWILIO_AUTH_TOKEN', sensitive: true },
      twilioFrom: { format: String, default: '', env: 'TWILIO_FROM' },
    },
    storage: {
      endpoint: { format: String, default: '', env: 'S3_ENDPOINT' },
      region: { format: String, default: 'us-east-1', env: 'S3_REGION' },
      bucket: { format: String, default: '', env: 'S3_BUCKET' },
      accessKeyId: { format: String, default: '', env: 'S3_ACCESS_KEY_ID', sensitive: true },
      secretAccessKey: {
        format: String,
        default: '',
        env: 'S3_SECRET_ACCESS_KEY',
        sensitive: true,
      },
    },
    observability: {
      sentryDsn: { format: String, default: '', env: 'SENTRY_DSN', sensitive: true },
      metricsEnabled: { format: Boolean, default: true, env: 'PROMETHEUS_METRICS_ENABLED' },
    },
    internal: {
      coreBankingUrl: { format: String, default: '', env: 'CORE_BANKING_URL' },
      adminApiUrl: { format: String, default: '', env: 'ADMIN_API_URL' },
      realtimeGatewayUrl: { format: String, default: '', env: 'REALTIME_GATEWAY_URL' },
    },
    web: {
      staticDir: {
        doc: 'Filesystem path to the built web SPA (apps/web/dist). When set and present, the api-gateway serves the SPA on the same origin as /api/v1, removing the need for a separate web service and PINE_BACKEND_URL. Leave empty to auto-detect the bundled build, or for pure-proxy deployments.',
        format: String,
        default: '',
        env: 'WEB_STATIC_DIR',
      },
    },
    security: {
      adminIpAllowlist: { format: String, default: '', env: 'ADMIN_IP_ALLOWLIST' },
      trustProxy: { format: Boolean, default: true, env: 'RATE_LIMIT_TRUST_PROXY' },
    },
    bootstrap: {
      enabled: { format: Boolean, default: false, env: 'ADMIN_BOOTSTRAP_ENABLED' },
      adminUsername: { format: String, default: 'admin', env: 'ADMIN_USERNAME' },
      adminEmail: { format: String, default: '', env: 'ADMIN_EMAIL' },
      adminPassword: {
        format: String,
        default: '',
        env: 'ADMIN_PASSWORD',
        sensitive: true,
      },
      runHistoricalSeed: { format: Boolean, default: false, env: 'RUN_HISTORICAL_SEED' },
    },
    migrations: {
      runOnStartup: {
        doc: 'Apply pending DB migrations automatically at service startup (advisory-locked).',
        format: Boolean,
        default: false,
        env: 'RUN_MIGRATIONS_ON_STARTUP',
      },
    },
    ...extraSchema,
  };

  const config = convict(schema);
  config.validate({ allowed: 'strict' });

  // Required-in-production checks for secrets.
  if (config.get('env') === 'production') {
    const required = [
      'database.url',
      'jwt.privateKeyB64',
      'jwt.publicKeyB64',
      'encryption.kekB64',
      'encryption.refreshTokenPepper',
    ];
    for (const path of required) {
      if (!config.get(path)) {
        throw new Error(`[lib-config] Missing required config in production: ${path}`);
      }
    }
  }

  return config.getProperties();
}
