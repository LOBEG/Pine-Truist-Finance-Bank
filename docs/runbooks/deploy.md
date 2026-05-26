# Deploy runbook (Railway)

## One-time project setup

1. Create two Railway projects: `pine-bank-prod` and `pine-bank-staging`.
2. In each project, attach plugin: **PostgreSQL 16** and an **S3-compatible
   bucket** (or external bucket via env). **No Redis required** — this
   application is fully Postgres-native.
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

   Variables required for every Node service: `DATABASE_URL`,
   `JWT_PRIVATE_KEY_B64`, `JWT_PUBLIC_KEY_B64`, `ENCRYPTION_KEK_B64`,
   `REFRESH_TOKEN_PEPPER`, `NODE_ENV=production`, `LOG_LEVEL=info`,
   `CORS_ORIGINS`, plus service-specific values from `.env.example`.

## Migrations

`migrate:deploy` runs as a Railway _release command_ on `core-banking-api`,
which gates startup of every other service. The CLI is idempotent:

```bash
DATABASE_URL=... DATABASE_SSL=require npm run migrate
```

## Bootstrap super_admin (Automatic)

The admin bootstrap runs automatically at server startup when enabled:

1. **First deploy**: Set these env vars in Railway:

   ```
   ADMIN_BOOTSTRAP_ENABLED=true
   ADMIN_EMAIL=admin@pinebank.com
   ADMIN_PASSWORD=<a-very-strong-16+-char-passphrase>
   ```

2. **Deploy once** — the admin user is created automatically at startup.

3. **After first deploy**: Set `ADMIN_BOOTSTRAP_ENABLED=false` (or remove it)
   in Railway service variables. This disables bootstrap on future deploys.

4. **Login**: Use the admin credentials at the login page. The admin will be
   required to change password and enroll MFA on first login.

**SECURITY**: Environment credentials are NEVER used for authentication.
Login always authenticates against the database password hash. See
`docs/admin-bootstrap.md` for details.

### Alternative: Manual CLI Bootstrap

For non-Railway environments or manual bootstrap:

```bash
ADMIN_EMAIL=admin@pinebank.com \
ADMIN_PASSWORD='a-very-long-passphrase' \
npm run create-admin
```

## Promotion (staging → production)

1. Merge feature branches into `staging`; verify on staging environment.
2. CI must pass (lint + tests + migration smoke + ledger reconciliation).
3. Open a PR `staging → main`. On merge, Railway redeploys production.
4. Rollback: in the Railway dashboard, redeploy the prior environment
   snapshot. Refresh tokens stay valid; if a compromise is suspected,
   `UPDATE sessions SET revoked_at = now(), revoked_reason = 'rollback';`.

## Health monitoring

Each HTTP service exposes `/healthz` (liveness) and `/readyz` (checks DB).
Configure Railway health checks to use `/healthz`. The `scheduler` runs an
hourly ledger reconciliation that publishes `ops.ledger.drift` on drift —
wire it to PagerDuty.
