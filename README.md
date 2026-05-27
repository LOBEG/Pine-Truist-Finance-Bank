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

## A-to-Z project concept

Pine Bank is an end-to-end digital banking system that models how a regulated
online bank can onboard customers, protect accounts, move money, monitor risk,
support administrators, and operate safely in production. The project is split
into independent services so the public web app, customer APIs, admin APIs,
real-time notifications, background processing, fraud checks, audit capture, and
scheduled banking jobs can scale and deploy separately.

At the center of the system is PostgreSQL. It stores customer and account data,
enforces a double-entry ledger, powers queues and pub/sub, records immutable
audit history, coordinates rate limits, and supports real-time fan-out without
requiring Redis. Every money movement is idempotent, validated, audited, and
posted through ledger entries instead of direct balance writes.

### Core idea

1. A customer registers or signs in through the React web app.
2. The API gateway validates public traffic and forwards requests to internal
   services.
3. The core banking API manages authentication, accounts, balances,
   counterparties, transfers, withdrawals, PIN checks, and transaction history.
4. Money movement creates transactions and ledger entries inside a database
   transaction.
5. Outbox events trigger notifications, fraud scoring, audit logging, and
   Socket.IO updates.
6. Admin users manage customers, issue transfer PINs, review withdrawals,
   release or reverse flagged transactions, update settings, and investigate
   audit/compliance records.
7. Workers and schedulers process background jobs such as notifications,
   external transfer state changes, fraud rules, audit partitioning, interest,
   statements, PIN cleanup, and reconciliation.

## Features

### Customer banking

- Customer registration, login, logout, refresh-token rotation, and MFA
  enrollment/verification.
- Account dashboard with checking, savings, money-market, CD, and investment
  account support.
- Live available and ledger balances computed from ledger entries.
- Transaction listing and transaction detail views with cursor-style API
  support.
- Internal transfers between owned accounts with admin-issued single-use
  transfer PIN protection.
- ACH and domestic wire transfer flows that are disabled by default until a real
  regulated external-rails provider is configured.
- Counterparty management for linked external accounts.
- Withdrawal requests with pending holds and later admin approval or rejection.
- Deposit, transfer, wire, withdrawal, notification, and transaction pages in the
  React web application.

### Admin and operations console

- Internal operations console under a configurable non-public base path.
- Admin user search, user detail, KYC status updates, account freeze controls,
  and customer role visibility.
- One-time 6-digit transfer PIN issuance and PIN revocation.
- Withdrawal review queue with approval and rejection actions.
- Fraud queue for transactions requiring manual review, release, or reversal.
- Compliance case management for KYC, AML, SAR, CTR, and dispute workflows.
- Audit-log search with actor, resource, action, and date filters.
- System settings management with audited changes.
- Admin bootstrap script for first super-admin provisioning.

### Ledger and transaction safety

- Strict double-entry accounting enforced by a database constraint trigger.
- Append-only ledger entries and audit logs; destructive mutations are blocked.
- Idempotency keys required for money-movement endpoints.
- Exact money handling with `numeric(20,4)` in PostgreSQL and scaled integer
  arithmetic in the ledger library.
- Computed balances through SQL functions and a balance cache for read-heavy
  paths.
- Pending and posted transaction states for holds, withdrawals, ACH, wires, and
  settlement workflows.
- Reconciliation script and scheduled reconciliation jobs to detect ledger drift.
- Historical seed data that generates two years of realistic banking activity.

### Security

- Argon2id password and PIN hashing.
- RS256 access tokens with short TTLs.
- Opaque rotating refresh tokens stored as peppered hashes with reuse detection.
- TOTP MFA support with encrypted MFA secrets and backup-code support.
- AES-256-GCM envelope encryption for sensitive columns such as SSNs, full
  account numbers, MFA secrets, counterparty account numbers, and wire
  beneficiary account numbers.
- Rate limits for login, PIN attempts, transfers, and global IP traffic.
- Helmet security headers, strict CORS, HSTS, CSP, referrer policy, and disabled
  `x-powered-by`.
- Admin API protection through RBAC, MFA requirements, and IP allowlisting.
- Pino log redaction for authorization headers, cookies, passwords, PINs, SSNs,
  and token-like fields.

### Risk, compliance, and audit

- Fraud-engine rules for velocity, large amount, off-hours, and new-counterparty
  risk.
- Fraud alerts and real-time admin notifications for transactions that need
  review.
- BSA/AML scaffolding through compliance cases and large-transaction detection.
- Reg E dispute intake through the compliance workflow.
- Reg CC-style pending deposit handling and funds-availability holds.
- GLBA privacy notice surface during signup.
- Monthly partitioned audit logs for retention and operational review.

### Realtime and background processing

- Socket.IO realtime gateway with JWT-authenticated handshakes.
- User, account, and admin rooms for targeted event delivery.
- Postgres-backed event publication and delivery coordination.
- pg-boss-backed queues for durable background jobs.
- Notification worker for email, SMS, push, and log-only fallback delivery.
- Transaction worker for ACH/wire state machines.
- Scheduler for ACH cutoff processing, interest accrual, session cleanup,
  transfer PIN cleanup, statements, and reconciliation.
- Audit worker for notable event mirroring and partition maintenance.

### Developer and deployment experience

- npm workspaces for all apps and shared packages.
- Shared libraries for config, logging, auth, crypto, database access, queues,
  events, validation, ledger posting, and HTTP middleware.
- OpenAPI documentation for customer and admin REST APIs.
- Railway-ready service layout with per-service configuration.
- Database migration CLI, seed command, key rotation script, admin creation
  script, and ledger reconciliation script.
- ESLint, Prettier, and Node test-runner based unit tests.
- Health and readiness endpoints for HTTP services.

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
