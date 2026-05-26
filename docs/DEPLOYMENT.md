# Pine Bank — Production Deployment Runbook

## 1. Architecture Overview

```
                         ┌─────────────────────────────────────┐
INTERNET ──── CDN/WAF ──▶│           api-gateway               │ ← public (Railway)
                         │        (2 replicas, port 80)        │
                         └───────────┬───────────┬─────────────┘
                                     │           │  Railway Private Network
                    ┌────────────────▼──┐  ┌─────▼────────────┐
                    │  core-banking-api │  │    admin-api      │
                    │   (port 8080)     │  │   (port 8080)     │
                    └─────────┬─────────┘  └────────┬──────────┘
                              │                     │
                    ┌─────────▼─────────────────────▼──────────┐
                    │             PostgreSQL 16                  │
                    │           (Railway managed)               │
                    └───────────────────────────────────────────┘
                    ┌─────────────────────────────────────────────┐
                    │               Redis 7                        │
                    │   Rate limits │ Pub/Sub │ Socket.IO adapter  │
                    └──────────────┬──────────────────────────────┘
                                   │
          ┌────────────────────────┼─────────────────────────┐
          │                        │                          │
   ┌──────▼──────┐  ┌─────────────▼──┐  ┌────────────────────▼──┐
   │fraud-engine │  │realtime-gateway│  │transaction-worker     │
   │audit-worker │  │  (WebSocket)   │  │notification-worker    │
   │scheduler    │  └────────────────┘  │                       │
   └─────────────┘                      └───────────────────────┘
```

**Services (10 total):**

| Service             | Type      | Replicas | Port | Purpose                                    |
| ------------------- | --------- | -------- | ---- | ------------------------------------------ |
| api-gateway         | HTTP      | 2        | 8080 | Public entry point, rate limiting, proxy   |
| core-banking-api    | HTTP      | 1+       | 8080 | Business logic, auth, transactions         |
| admin-api           | HTTP      | 1        | 8080 | Internal admin operations                  |
| realtime-gateway    | WebSocket | 1+       | 8080 | Socket.IO live events                      |
| fraud-engine        | Worker    | 1        | —    | Transaction fraud scoring                  |
| audit-worker        | Worker    | 1        | —    | Event → audit_log mirroring                |
| notification-worker | Worker    | 1        | —    | Email/SMS dispatch                         |
| transaction-worker  | Worker    | 1        | —    | ACH/wire state machine                     |
| scheduler           | Singleton | 1        | —    | Cron jobs (interest, sessions, statements) |
| web                 | Static    | 1        | 3000 | React frontend (Vite preview)              |

---

## 2. Prerequisites

### Railway Account Setup

1. Create a Railway account at https://railway.app
2. Install the Railway CLI: `npm install -g @railway/cli`
3. Authenticate: `railway login`
4. Create a project: `railway init`

### GitHub Secrets Required

Set these in **Settings → Secrets → Actions**:

```
RAILWAY_TOKEN                       # Railway API token (from railway.app → Account → Tokens)
RAILWAY_PROJECT_ID                  # From railway.app project settings
RAILWAY_PRODUCTION_ENVIRONMENT_ID   # From railway.app environment settings
RAILWAY_STAGING_ENVIRONMENT_ID      # From railway.app environment settings
```

---

## 3. First-Time Deployment

### 3.1 Generate Production Secrets

Run these commands locally and paste the output into Railway service variables:

```bash
# JWT RS256 key pair (2048-bit minimum; 4096 recommended for production)
openssl genrsa -out /tmp/jwt_private.pem 4096
openssl rsa -in /tmp/jwt_private.pem -pubout -out /tmp/jwt_public.pem
export JWT_PRIVATE_KEY_B64=$(base64 -w0 /tmp/jwt_private.pem)
export JWT_PUBLIC_KEY_B64=$(base64 -w0 /tmp/jwt_public.pem)
echo "JWT_PRIVATE_KEY_B64=$JWT_PRIVATE_KEY_B64"
echo "JWT_PUBLIC_KEY_B64=$JWT_PUBLIC_KEY_B64"
shred -u /tmp/jwt_private.pem /tmp/jwt_public.pem

# AES-256 KEK (Key Encryption Key) — 32 random bytes
openssl rand -base64 32
# → paste as ENCRYPTION_KEK_B64

# Refresh token pepper — 32 random bytes
openssl rand -base64 32
# → paste as REFRESH_TOKEN_PEPPER
```

### 3.2 Provision Infrastructure on Railway

```bash
# Link CLI to your project
railway link

# Add PostgreSQL plugin (only database needed - no Redis required)
railway add --plugin postgresql

# Railway sets DATABASE_URL automatically via its plugin system.
# Verify:
railway variables --service core-banking-api
```

### 3.3 Set Environment Variables per Service

In the Railway dashboard, navigate to each service → Variables and set:

**Shared across all services:**

```
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=${{Postgres.DATABASE_URL}}     # Railway reference syntax
```

**core-banking-api (and admin-api):**

```
JWT_PRIVATE_KEY_B64=<generated above>
JWT_PUBLIC_KEY_B64=<generated above>
JWT_ISSUER=pine-bank
JWT_AUDIENCE=pine-bank-clients
JWT_ACCESS_TTL_SECONDS=600
JWT_REFRESH_TTL_SECONDS=2592000
ENCRYPTION_KEK_B64=<generated above>
REFRESH_TOKEN_PEPPER=<generated above>
CORS_ORIGINS=https://app.pinebank.com,https://admin.pinebank.com
RATE_LIMIT_TRUST_PROXY=true
POSTMARK_TOKEN=<your Postmark token>
EMAIL_FROM=Pine Bank <no-reply@pinebank.com>
TWILIO_ACCOUNT_SID=<your Twilio SID>
TWILIO_AUTH_TOKEN=<your Twilio token>
TWILIO_FROM=<your Twilio number>
ADMIN_IP_ALLOWLIST=<comma-separated CIDR blocks for admin access>
CORE_BANKING_URL=http://core-banking-api.railway.internal:8080
ADMIN_API_URL=http://admin-api.railway.internal:8080
REALTIME_GATEWAY_URL=http://realtime-gateway.railway.internal:8080
```

**api-gateway only:**

```
CORE_BANKING_URL=http://core-banking-api.railway.internal:8080
ADMIN_API_URL=http://admin-api.railway.internal:8080
```

**realtime-gateway only:**

```
JWT_PUBLIC_KEY_B64=<same as above>
JWT_ISSUER=pine-bank
JWT_AUDIENCE=pine-bank-clients
CORS_ORIGINS=https://app.pinebank.com
```

**web only:**

```
PINE_API_URL=https://api.pinebank.com/api/v1
PINE_REALTIME_URL=https://realtime.pinebank.com
PORT=3000
```

**scheduler only:**

```
TZ=America/New_York
```

### 3.4 Run Database Migrations

Railway's `preDeployCommand` in `apps/core-banking-api/railway.json` runs
`node db/cli.js migrate` automatically before each deploy. For the first deploy,
you can also trigger it manually:

```bash
railway run --service core-banking-api node db/cli.js migrate
```

### 3.5 Bootstrap the Admin User (Automatic)

The admin user is bootstrapped automatically at server startup when enabled.

**Step 1: Add these env vars for the first deploy only:**

```
ADMIN_BOOTSTRAP_ENABLED=true
ADMIN_EMAIL=admin@pinebank.com
ADMIN_PASSWORD=<strong-16+-character-password-with-uppercase-lowercase-digit>
```

**Step 2: Deploy once** — the admin user is created at startup.

**Step 3: After first deploy**, set `ADMIN_BOOTSTRAP_ENABLED=false` (or remove it).

**IMPORTANT SECURITY NOTES:**

- Password must be ≥16 chars with uppercase, lowercase, and digit
- Environment credentials are NEVER used for login authentication
- Login always authenticates against the database password hash
- Admin must change password and enroll MFA on first login
- See `docs/admin-bootstrap.md` for full documentation

**Alternative: Manual CLI Bootstrap**

```bash
railway run --service core-banking-api \
  ADMIN_EMAIL=admin@pinebank.com \
  ADMIN_PASSWORD=<strong-password> \
  node scripts/create-admin.js
```

### 3.6 Deploy All Services

Railway's GitHub integration will auto-deploy on push to `main`. You can also
trigger manually:

```bash
# Deploy all services
railway up

# Or deploy a specific service
railway up --service core-banking-api
```

---

## 4. Custom Domains & SSL

Railway provisions TLS certificates automatically via Let's Encrypt for any
custom domain you configure.

1. In the Railway dashboard: Service → Settings → Domains → Add Custom Domain
2. Add a CNAME record pointing to your Railway domain
3. Railway handles certificate provisioning and renewal

**Recommended domain setup:**

```
api.pinebank.com       → api-gateway Railway service
app.pinebank.com       → web Railway service
realtime.pinebank.com  → realtime-gateway Railway service
admin.pinebank.com     → admin-api Railway service (restrict to VPN/IP)
```

**CDN recommendations:**

- Use Cloudflare in front of `api.pinebank.com` and `app.pinebank.com`
- Enable Cloudflare's DDoS protection and Bot Management
- Set Cloudflare to "Full (strict)" SSL mode
- Enable Cloudflare's WAF with OWASP rules
- Do NOT proxy `realtime.pinebank.com` through Cloudflare (WebSocket)
  — use Railway's direct domain for Socket.IO

---

## 5. Scaling Guide

### Horizontal Scaling (Railway)

```bash
# Scale api-gateway to 3 replicas
railway scale --service api-gateway --replicas 3

# Scale core-banking-api to 2 replicas
railway scale --service core-banking-api --replicas 2
```

**Scaling constraints:**
| Service | Min | Max | Notes |
|---------|-----|-----|-------|
| api-gateway | 2 | 10 | Stateless — scale freely |
| core-banking-api | 1 | 5 | Stateless — scale freely |
| admin-api | 1 | 2 | Low-traffic internal service |
| realtime-gateway | 1 | 5 | Redis adapter enables multi-node Socket.IO |
| fraud-engine | 1 | 3 | Idempotent via consumer_dedup |
| audit-worker | 1 | 1 | Singleton — partition maintenance runs once |
| notification-worker | 1 | 2 | Idempotent via consumer_dedup |
| transaction-worker | 1 | 1 | Singleton — state machine has no distributed lock |
| scheduler | 1 | 1 | **Must be singleton** — duplicate cron runs cause double-processing |
| web | 1 | 3 | Static files, easily scaled |

### Database Connection Pooling

PgBouncer is not required on Railway (Railway Postgres handles connection pooling
at the infrastructure level). If you add it:

- Use `pool_mode=transaction` for stateless API services
- Use `pool_mode=session` for the scheduler (advisory locks)

---

## 6. Monitoring Setup

### 6.1 Railway Built-in Metrics

Railway exposes CPU, memory, and request count metrics in the dashboard.
Enable notifications for:

- Container restarts > 3/hour
- Memory usage > 80%
- CPU usage > 90% for > 5 minutes

### 6.2 Application-level Health Endpoints

All HTTP services expose:

- `GET /healthz` — liveness (returns `200 {ok: true}`)
- `GET /readyz` — readiness (checks DB + Redis connectivity)

Use Railway's health check configuration (already set in each `railway.json`).

### 6.3 Sentry (Error Tracking)

```bash
# Set in all services:
SENTRY_DSN=https://<key>@sentry.io/<project>
```

Add Sentry SDK initialization to each server's entry point for
production error tracking with stack traces and context.

### 6.4 Prometheus + Grafana (Optional)

If using `PROMETHEUS_METRICS_ENABLED=true`, expose a `/metrics` endpoint
and scrape with a Prometheus deployment in the same Railway environment.

Recommended dashboards:

- Node.js default metrics (memory, event loop lag, GC)
- HTTP request rate, p50/p95/p99 latency, error rate
- PostgreSQL connection pool utilization
- Redis memory usage and hit rate
- Fraud detection score distribution

### 6.5 Log Aggregation

All services emit structured JSON logs via Pino. Railway streams logs to its
built-in log viewer. For persistent log storage:

1. Enable Railway's log draining to an external service
2. Recommended destinations: Logtail (Better Stack), Datadog, or Papertrail
3. Set alerts for:
   - `level: error` — immediate PagerDuty/Slack alert
   - `LEDGER DRIFT DETECTED` — immediate alert + incident
   - `fraud.alert` — Slack notification to fraud team
   - `auth.login.failed` at high rate — security team alert

---

## 7. Backup Strategy

### PostgreSQL Backups

Railway PostgreSQL includes automated daily backups with 7-day retention
on the Starter plan and 30-day retention on the Pro plan.

For additional protection:

```bash
# Manual backup (run from a one-off Railway container)
railway run --service core-banking-api \
  pg_dump $DATABASE_URL | gzip > pine_backup_$(date +%Y%m%d).sql.gz

# Restore
railway run --service core-banking-api \
  gunzip -c pine_backup_20260101.sql.gz | psql $DATABASE_URL
```

### Automated Backup Pipeline

Create a Railway cron service (or extend `scheduler`) to:

1. `pg_dump` the database nightly at 01:00 ET
2. Compress with `gzip`
3. Upload to S3 (`S3_ENDPOINT`, `S3_BUCKET` vars)
4. Delete local copy
5. Alert if backup fails

**Retention policy:**

- Daily backups: 30 days
- Weekly backups (every Sunday): 12 weeks
- Monthly backups (1st of month): 12 months

### Redis Persistence

Redis data is ephemeral (rate limit counters and pub/sub). No backup required.
Rate limit state resets on Redis restart; this is acceptable.

---

## 8. Disaster Recovery

### 8.1 Service Restart

Railway automatically restarts failed containers (`ON_FAILURE` policy, 10 retries).
Manual restart:

```bash
railway redeploy --service <service-name>
```

### 8.2 Rollback

```bash
# Railway CLI rollback to previous deployment
railway rollback --service <service-name>

# Or use Railway dashboard → Service → Deployments → select previous → Redeploy
```

### 8.3 Database Recovery

```bash
# Point-in-time restore via Railway dashboard:
# Postgres plugin → Backups → select timestamp → Restore

# Manual restore from backup:
railway run --service core-banking-api \
  gunzip -c backup.sql.gz | psql $DATABASE_URL
```

### 8.4 Full Environment Recovery (RTO < 1 hour)

1. Provision new Railway project
2. Add PostgreSQL and Redis plugins
3. Set all environment variables (use the list in section 3.3)
4. Push to `main` — CI runs migrations and deploys all services automatically
5. Restore database from latest backup
6. Verify `/readyz` on all HTTP services
7. Run `npm run reconcile-ledger` to verify ledger integrity

---

## 9. Deployment Commands Reference

```bash
# ---- Local production-parity testing ----
docker compose --env-file .env up --build

# ---- Railway CLI ----
railway login
railway link                          # link to project
railway status                        # show current deployments
railway logs --service <name>         # stream logs
railway run --service <name> <cmd>    # run one-off command in service
railway up                            # deploy all services
railway up --service <name>           # deploy one service
railway rollback --service <name>     # rollback to previous deploy
railway variables --service <name>    # show environment variables
railway open                          # open Railway dashboard

# ---- Database operations ----
npm run migrate                        # run all pending migrations
npm run migrate:status                 # show migration status
npm run seed                           # seed initial data (dev only)
npm run reconcile-ledger               # verify ledger double-entry integrity
npm run rotate-keys                    # rotate JWT keys (zero-downtime)
npm run create-admin                   # bootstrap first admin user

# ---- Key generation ----
openssl genrsa -out jwt_private.pem 4096
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
openssl rand -base64 32               # for KEK / pepper generation
```

---

## 10. Environment Variable Reference

See `.env.example` for the complete list. All secrets must be set as Railway
Service Variables — never committed to version control.

**Critical (deployment will fail without these in production):**

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_PRIVATE_KEY_B64`
- `JWT_PUBLIC_KEY_B64`
- `ENCRYPTION_KEK_B64`
- `REFRESH_TOKEN_PEPPER`

---

_Document Version: 1.0.0 — Last Updated: 2026-05-25_
