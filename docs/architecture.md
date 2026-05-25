# Pine Bank — System Architecture

This document is the source of truth for the system architecture. The README
points to it.

## 1. Topology (Railway services)

| Service               | Path                       | Public?                                 | Purpose                                                                                                                                     |
| --------------------- | -------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `web-frontend`        | `apps/web`                 | ✅                                      | React SPA (Vite). Tailwind UI.                                                                                                              |
| `api-gateway`         | `apps/api-gateway`         | ✅                                      | Public REST entrypoint: helmet, CORS, JWT verify, Redis rate limits, proxy to internal services.                                            |
| `core-banking-api`    | `apps/core-banking-api`    | private                                 | Customer features: auth, accounts, transfers, PIN consume, withdrawals, counterparties.                                                     |
| `admin-api`           | `apps/admin-api`           | ✅ (IP-allowlisted, Cloudflare-fronted) | Admin/compliance: user management, PIN issuance, withdrawal approval, transaction release/reverse, compliance cases, audit query, settings. |
| `realtime-gateway`    | `apps/realtime-gateway`    | ✅                                      | Socket.IO + Redis adapter. JWT handshake. Fan-out from pub/sub.                                                                             |
| `notification-worker` | `apps/notification-worker` | private                                 | Email/SMS/push dispatcher (Postmark/Twilio). Idempotent on outbox id.                                                                       |
| `transaction-worker`  | `apps/transaction-worker`  | private                                 | ACH/wire state machines: initiated → submitted → settled.                                                                                   |
| `fraud-engine`        | `apps/fraud-engine`        | private                                 | Rule pipeline (velocity, large amount, off-hours, new counterparty).                                                                        |
| `audit-worker`        | `apps/audit-worker`        | private                                 | Mirrors notable Redis events to `audit_logs`; rolls partitions.                                                                             |
| `scheduler`           | `apps/scheduler`           | private                                 | node-cron: ACH cutoff, interest accrual, session/pin reaper, statements, reconciliation.                                                    |

Managed Railway plugins: **PostgreSQL 16** (primary; logical replica for
reporting), **Redis 7** (cache + queues + pub/sub + rate-limit), and an
**S3-compatible bucket** for statements, KYC, and audit cold storage.

## 2. Request flow — internal transfer

```
Client ─► web-frontend ─► api-gateway
                              │ (JWT verified, rate-limited, request-id)
                              ▼
                       core-banking-api
                              │  1. zod-validate body
                              │  2. argon2-verify admin-issued PIN
                              │  3. SQL transaction:
                              │     SELECT … FOR UPDATE on both accounts
                              │     check available_balance(src) >= amount
                              │     INSERT transactions(status=posted, idemp_key)
                              │     INSERT ledger_entries(debit src, credit dst)
                              │     UPDATE transfer_pins.status='consumed'
                              │     INSERT outbox(transaction.posted)
                              │  4. COMMIT
                              ▼
                  ┌──────── outbox relay ────────┐
                  ▼                              ▼
              Redis pub/sub                  BullMQ queues
                  │                              │
                  ├─► realtime-gateway      ├─► notification-worker
                  │   io.to(user:<id>)      │   sends posted-email
                  │   io.to(account:<id>)   │
                  ├─► fraud-engine          └─► audit-worker
                  │   scores & may flag         appends audit_logs
                  └─► admin:global (if flagged)
```

The same shape applies to ACH (pending → submitted → settled, T+1/T+2 by
`transaction-worker`) and to wires (initiated → sent → settled). Pending legs
are placed as `ledger_entries.status = 'pending'`; the **double-entry trigger
only enforces balance on `posted` entries** so holds need no counter-leg.

## 3. Data model highlights

- **Money** is `numeric(20,4)` everywhere. `lib-ledger` uses `BigInt`
  scaled by 10 000 for exact arithmetic; floats are never used.
- **Balances are computed**, never stored. `account_available_balance(uuid)`
  and `account_ledger_balance(uuid)` are SQL functions; the `account_balances`
  view exposes them for read-heavy paths.
- **Append-only audit** via `audit_logs` partitioned monthly. A `BEFORE
UPDATE OR DELETE OR TRUNCATE` trigger raises an exception.
- **Outbox** table guarantees at-least-once event publication; consumers
  dedupe via `consumer_dedup(consumer, event_id)`.
- **Transfer PINs** are admin-issued, argon2id-hashed, single-use,
  expirable (default 30 min), and bound to optionally a specific transaction.

## 4. Real-time events

All domain events go to one of six Redis pub/sub channels
(`pine.events.{transactions,withdrawals,pins,fraud,compliance,auth}`).
`realtime-gateway` subscribes to all six and fans out per-user and per-account
to Socket.IO rooms (`user:<id>`, `account:<id>`, `admin:global`). Membership
in `user:<id>` is established by JWT handshake; other rooms are constrained
to authenticated ownership.

## 5. Security model

See `docs/runbooks/security.md` for the operational details. Key points:

- **JWT RS256** access tokens (10-min TTL by default) signed by a private key
  in Railway secrets; public key distributed to verifying services.
- **Refresh tokens** are opaque 256-bit tokens. The DB stores
  SHA-256 + pepper of each token; rotation on every use; reuse of an old
  token invalidates the entire session **family**.
- **Argon2id** parameters tuned to OWASP 2024 recommendation (19 MiB,
  t=2, p=1).
- **TOTP MFA** mandatory for admin roles.
- **Column-level encryption** (AES-256-GCM envelope, per-row DEK wrapped by
  the KEK) on SSN, full account numbers, MFA secrets, counterparty
  account numbers, wire beneficiary account numbers.
- **Rate limits** in Redis: 5/min/IP and 10/hour/email on login,
  3/PIN absolute, 10/hour/user on PIN attempts, 20/min/user on transfers,
  600/min/IP global.
- **CSP** strict (no inline scripts), **HSTS** preload, **SameSite=strict**,
  `frame-ancestors 'none'`.
- **Idempotency** required for every money-movement POST.

## 6. Folder structure

```
pine-bank/
├── apps/
│   ├── web/                         # React + Tailwind + Vite
│   ├── api-gateway/                 # public REST entrypoint
│   ├── core-banking-api/            # customer APIs
│   ├── admin-api/                   # admin APIs
│   ├── realtime-gateway/            # Socket.IO
│   ├── notification-worker/
│   ├── transaction-worker/
│   ├── fraud-engine/
│   ├── audit-worker/
│   └── scheduler/
├── packages/
│   ├── lib-config/                  # convict schemas
│   ├── lib-logger/                  # pino + request-id
│   ├── lib-auth/                    # JWT, RBAC, MFA
│   ├── lib-crypto/                  # AES-GCM envelope, argon2
│   ├── lib-db/                      # pg pool, transactions
│   ├── lib-queue/                   # BullMQ + outbox relay
│   ├── lib-events/                  # Redis pub/sub + topic registry
│   ├── lib-validation/              # zod schemas
│   ├── lib-ledger/                  # double-entry posting engine
│   └── lib-http/                    # error handler, helmet, CORS
├── db/
│   ├── migrations/                  # 0001_init.sql … 0005_seed_rbac.sql
│   └── seeds/historical.js          # 2-year history generator
├── scripts/
│   ├── create-admin.js
│   ├── rotate-keys.js
│   └── reconcile-ledger.js
├── docs/
│   ├── architecture.md
│   ├── production-readiness.md
│   ├── api/openapi.yaml
│   └── runbooks/
├── tests/unit/
└── .github/workflows/{ci,deploy}.yml
```
