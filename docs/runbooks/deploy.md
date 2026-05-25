# Deploy runbook (Railway)

## One-time project setup

1. Create two Railway projects: `pine-bank-prod` and `pine-bank-staging`.
2. In each project, attach plugins: **PostgreSQL 16**, **Redis 7**, and an
   **S3-compatible bucket** (or external bucket via env).
3. Create one Railway service per directory under `apps/` and connect each
   to this GitHub repository, pointing the _Root Directory_ setting at the
   service folder (e.g. `apps/core-banking-api`). Railway picks up the
   service's local `railway.json` for start command and health check.
4. Add the public domains: `app.pinebank.com` → `web-frontend`,
   `api.pinebank.com` → `api-gateway`, `admin.pinebank.com` → `admin-api`
   (front this with Cloudflare and an IP allowlist + WAF).
5. Generate secrets and paste into Railway _Service Variables_ for every
   service (workers also need them):

   ```bash
   node scripts/rotate-keys.js
   ```

   Variables required for every Node service: `DATABASE_URL`, `REDIS_URL`,
   `JWT_PRIVATE_KEY_B64`, `JWT_PUBLIC_KEY_B64`, `ENCRYPTION_KEK_B64`,
   `REFRESH_TOKEN_PEPPER`, `NODE_ENV=production`, `LOG_LEVEL=info`,
   `CORS_ORIGINS`, plus service-specific values from `.env.example`.

## Migrations

`migrate:deploy` runs as a Railway _release command_ on `core-banking-api`,
which gates startup of every other service. The CLI is idempotent:

```bash
DATABASE_URL=... DATABASE_SSL=require npm run migrate
```

## Bootstrap super_admin

After the first successful deploy:

```bash
BOOTSTRAP_ADMIN_EMAIL=admin@pinebank.com \
BOOTSTRAP_ADMIN_PASSWORD='a-very-long-passphrase' \
npm run create-admin
```

This account is forced to change password and enrol MFA on first login.

## Promotion (staging → production)

1. Merge feature branches into `staging`; verify on staging environment.
2. CI must pass (lint + tests + migration smoke + ledger reconciliation).
3. Open a PR `staging → main`. On merge, Railway redeploys production.
4. Rollback: in the Railway dashboard, redeploy the prior environment
   snapshot. Refresh tokens stay valid; if a compromise is suspected,
   `UPDATE sessions SET revoked_at = now(), revoked_reason = 'rollback';`.

## Health monitoring

Each HTTP service exposes `/healthz` (liveness) and `/readyz` (checks DB
and Redis). Configure Railway health checks to use `/healthz`. The
`scheduler` runs an hourly ledger reconciliation that publishes
`ops.ledger.drift` on drift — wire it to PagerDuty.
