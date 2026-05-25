# Production Readiness Checklist

Tracks the go-live checklist from the engineering plan. Verified items have
direct evidence in code or CI; the remainder are operational tasks that must
happen during release.

## Code & Build

- [x] All services build cleanly on Node 20; no TypeScript; ESM throughout.
- [x] ESLint + Prettier enforced (`npm run lint`, `npm run format:check`).
- [x] `npm test` runs `node --test` unit suite (lib-ledger + lib-crypto).
- [x] `npm ci` is reproducible (root lockfile, no postinstall scripts).
- [ ] Conventional commits + semantic-release tagging (configure in CI when ready).

## Database

- [x] All migrations idempotent (`IF NOT EXISTS`) and timestamp-ordered.
- [x] `pgcrypto` + `citext` extensions installed in `0001_init.sql`.
- [x] Double-entry constraint trigger installed (`enforce_double_entry`).
- [x] Append-only triggers on `ledger_entries` and `audit_logs`.
- [x] Hot-path indexes on `transactions(source_account_id, posted_at desc)` etc.
- [x] `account_available_balance(uuid)` / `account_ledger_balance(uuid)`
      functions are the single source of truth.
- [x] Reconciliation cron + `scripts/reconcile-ledger.js` verify drift.
- [ ] Railway automated daily backups + WAL; restore drill documented and executed (operational).
- [ ] PITR retention ≥ 30 days (Railway plan configuration).

## Security

- [x] Argon2id parameters tuned (19 MiB, t=2, p=1) — `packages/lib-crypto`.
- [x] JWT RS256 keys generated via `scripts/rotate-keys.js`; config refuses
      to boot in `production` without them.
- [x] Refresh-token rotation + reuse detection in `core-banking-api/services/session.js`.
- [x] Column-level AES-256-GCM envelope encryption for SSN, account numbers,
      MFA secrets, counterparty/wire beneficiary account numbers.
- [x] MFA enrolment endpoint; admin RBAC requires non-customer roles.
- [x] helmet + CSP + HSTS + `frame-ancestors 'none'` + strict referrer policy.
- [x] Redis-backed rate limits validated by Express middleware.
- [x] zod validation on every state-changing route.
- [x] pino redaction list configured (`authorization`, `cookie`, `password`,
      `pin`, `ssn`, `*.token`, …) — secrets never logged.
- [ ] Penetration test completed; criticals fixed (operational).
- [ ] Snyk/Dependabot enabled on the repo (operational).

## Compliance

- [x] BSA/AML scaffolding: `compliance_cases` with SAR/CTR types;
      transactions > $10k trigger fraud-engine `large_amount` rule.
- [x] Reg E dispute intake achievable via compliance cases workflow.
- [x] Reg CC: deposits credit as `pending` and require funds-availability
      hold release before being part of `account_available_balance`.
- [x] GLBA privacy notice surface point at signup (frontend `Register` page).
- [x] Audit log append-only verified by `audit_logs_append_only` trigger.
- [ ] 7-year data retention policy enforced (operational; archival via
      `audit-worker` partitions older than 90 days to S3).

## Reliability

- [x] `/healthz` and `/readyz` on every HTTP service.
- [x] BullMQ DLQ retention configured in `packages/lib-queue`.
- [x] Idempotency key required on every money-movement POST (enforced by
      `postTransaction()` and by route middleware).
- [x] Outbox-relay claim is atomic (`UPDATE … FROM CTE WHERE … SKIP LOCKED`).
- [x] Graceful shutdown: drain HTTP, close DB pool on SIGTERM/SIGINT.
- [ ] Circuit breakers around partner-bank APIs (transaction-worker hook).
- [ ] 500 RPS sustained transfer load test without ledger drift (operational).

## Realtime

- [x] Socket.IO Redis adapter configured in `realtime-gateway`.
- [x] JWT validated at handshake; rooms scoped to authenticated user/account.
- [ ] Reconnect/backoff verified across multiple `realtime-gateway` replicas
      under load (operational).

## Observability

- [x] Structured logs with correlation IDs across services (pino + `req.id`).
- [x] Sentry DSN wired into config schema.
- [ ] Datadog/Logtail log drain configured on Railway (operational).
- [ ] Prometheus metrics endpoint enabled (operational toggle, scaffolded).
- [ ] SLOs published (99.9 % API, p95 read < 300 ms, p95 write < 800 ms).

## Deployment

- [x] Each service has its own `railway.json` with start command, health
      check, and restart policy.
- [x] Root `railway.json` defaults at project level.
- [x] CI pipeline runs lint + tests + migration smoke + ledger reconciliation
      against ephemeral Postgres/Redis services.
- [ ] Cloudflare WAF + IP allowlist in front of `admin-api` (operational).
- [ ] HSTS preload submitted to hstspreload.org (operational; header already set).

## Data

- [x] 2-year historical seed (`db/seeds/historical.js`) generates salary
      deposits, recurring bills, transfers, and interest accruals across
      every account so aggregate balances ≥ $4 000 000 distributed
      approximately Checking $312k / Savings $1.45M / Money Market $1.7M /
      Investment $610k.
- [x] No code path writes balances directly; everything flows through
      `postTransaction()` and ledger entries.
- [x] Statement opening/closing balances derive from ledger entries
      (`scheduler/monthlyStatements`).

## Operations

- [x] `scripts/create-admin.js` provisions a `super_admin` with
      `must_change_password = TRUE` and forces MFA enrolment on first login.
- [x] `scripts/rotate-keys.js` emits all secret material; rotation procedure
      documented in `docs/runbooks/security.md`.
- [x] `scripts/reconcile-ledger.js` for incident-time ledger verification.
- [ ] Incident response plan with severity matrix (operational).
- [ ] Customer support tooling (read-only transaction view) — implemented in
      `admin-api` `GET /users/:id` + audit query.
