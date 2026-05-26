# Pine Bank — Production-Grade Online Banking Infrastructure

A reference implementation of a production-grade online banking platform built
for **Railway.app** deployment. Implements the full architecture described in
[`docs/architecture.md`](docs/architecture.md):

- Node.js + Express microservices (`core-banking-api`, `admin-api`,
  `api-gateway`, `realtime-gateway`) and pg-boss-backed workers
  (`notification-worker`, `transaction-worker`, `fraud-engine`,
  `audit-worker`, `scheduler`).
- React + TailwindCSS + Vite single-page application (`apps/web`).
- PostgreSQL 16 with a strict **double-entry ledger**, append-only audit log,
  monthly-partitioned tables, and per-column encryption-at-rest of PII.
- **Fully Postgres-native** — no Redis required. Queues (pg-boss), pub/sub
  (LISTEN/NOTIFY), rate limiting, and Socket.IO coordination all use Postgres.
- Argon2id passwords + 6-digit admin-issued single-use **transfer PINs** +
  RS256 JWT access tokens + rotating refresh tokens with reuse detection.
- BSA/AML, Reg E, Reg CC, GLBA, PCI/SOC2-aligned audit and retention controls.

## Repository layout

```
pine-bank/
├── apps/                # Deployable services and the web SPA
├── packages/            # Shared libraries (@pine/lib-*)
├── db/                  # SQL migrations and historical seed
├── scripts/             # Operational scripts (create-admin, rotate-keys, …)
├── docs/                # Architecture, runbooks, OpenAPI spec
├── tests/               # Unit / integration / e2e tests
├── .github/workflows/   # CI and deploy notifications
└── railway.json         # Railway project default
```

## Quick start (local development)

```bash
# 1. Install deps (npm workspaces installs every workspace)
npm install

# 2. Bring up Postgres (no Redis needed)
docker run -d --name pine-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine

# 3. Configure environment
cp .env.example .env
node scripts/rotate-keys.js >> .env   # generates JWT keypair + KEK + pepper

# 4. Apply migrations
npm run migrate

# 5. Bootstrap an admin (option A: automatic at startup)
ADMIN_BOOTSTRAP_ENABLED=true \
ADMIN_EMAIL=admin@pinebank.local \
ADMIN_PASSWORD='Change-Me-Very-Long-Passphrase-123' \
npm run dev:api

# 5. Bootstrap an admin (option B: manual CLI)
ADMIN_EMAIL=admin@pinebank.local \
ADMIN_PASSWORD='Change-Me-Very-Long-Passphrase-123' \
npm run create-admin

# 6. (Optional) load 2-year historical seed
npm run seed

# 7. Start services
npm run dev:api      # core-banking-api
npm run dev:admin    # admin-api
npm run dev:gateway  # api-gateway
npm run dev:realtime # realtime-gateway
npm run dev:web      # React SPA
```

## Production deployment (Railway)

Each subdirectory under `apps/` is its own Railway service, configured by its
local `railway.json`. The root `railway.json` plus
[`docs/runbooks/deploy.md`](docs/runbooks/deploy.md) describe end-to-end
deployment, secrets, blue/green strategy, and rollback.

## Security posture

- Argon2id for all passwords and 6-digit transfer PINs.
- RS256 JWT access tokens with short TTL + rotating refresh tokens with
  reuse-detection that invalidates the entire session family.
- AES-256-GCM envelope encryption for sensitive columns (SSN, full account
  number, MFA secrets, counterparty account numbers, wire beneficiary
  account numbers).
- Append-only `audit_logs` enforced at the database level.
- Double-entry ledger invariant enforced via a deferred constraint trigger;
  every money-movement endpoint requires an idempotency key.
- Postgres-backed rate limits on login (5/min/IP, 10/hour/email),
  PIN attempts (3/PIN, 10/hour/user), transfers (20/min/user), and a
  global IP cap.
- `admin-api` is IP-allowlisted; in production it must sit behind Cloudflare
  with a WAF (see runbook).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — full system design.
- [`docs/api/openapi.yaml`](docs/api/openapi.yaml) — REST API spec.
- [`docs/runbooks/`](docs/runbooks/) — operational runbooks.
- [`docs/admin-bootstrap.md`](docs/admin-bootstrap.md) — admin bootstrap
  documentation (one-time setup, security notes).
- [`docs/production-readiness.md`](docs/production-readiness.md) — go-live
  checklist (the same one in the plan, with verification status).

## License

UNLICENSED — internal proprietary code.
