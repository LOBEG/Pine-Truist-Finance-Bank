# Pine Bank — Security Architecture & Hardening Report

## 1. Executive Summary

Pine Bank implements a defense-in-depth security architecture suitable for production financial services. This document serves as the authoritative security reference, threat model, and hardening checklist.

---

## 2. Security Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTERNET / CDN / WAF                            │
├─────────────────────────────────────────────────────────────────────────┤
│                          API GATEWAY                                    │
│  • Rate limiting (Redis-backed)         • Helmet security headers       │
│  • CORS enforcement                     • Proxy timeout controls        │
│  • Global IP rate limiter (600/min)     • Trust proxy (Railway)         │
├──────────────┬──────────────────────────────────────────────────────────┤
│              │ Railway Private Network (*.railway.internal)              │
│              ▼                                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐                  │
│  │  CORE BANKING API    │    │    ADMIN API          │                  │
│  │  • RS256 JWT auth    │    │    • Role-based ACL   │                  │
│  │  • CSRF protection   │    │    • IP allowlist     │                  │
│  │  • Input sanitization│    │    • MFA required     │                  │
│  │  • Rate limiters     │    │    • Audit logging    │                  │
│  │  • PIN verification  │    └──────────────────────┘                  │
│  └────────┬─────────────┘                                              │
│           │                                                             │
│  ┌────────▼─────────┐   ┌───────────────┐   ┌───────────────────┐     │
│  │  PostgreSQL       │   │   Redis        │   │  Fraud Engine     │     │
│  │  • TLS required   │   │   • AUTH       │   │  • Velocity rules │     │
│  │  • Column encrypt │   │   • Rate stores│   │  • Amount limits  │     │
│  │  • Append-only    │   │   • Pub/sub    │   │  • Off-hours      │     │
│  │    audit logs     │   │   • Session    │   │  • New CP checks  │     │
│  └──────────────────┘   └───────────────┘   └───────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication & Session Security

### 3.1 JWT Architecture

| Property    | Implementation                                              |
| ----------- | ----------------------------------------------------------- |
| Algorithm   | RS256 (asymmetric — private key signs, public key verifies) |
| Access TTL  | 600s (10 minutes)                                           |
| Refresh TTL | 30 days                                                     |
| Issuer      | `pine-bank` (validated on verify)                           |
| Audience    | `pine-bank-clients` (validated on verify)                   |
| Subject     | User UUID                                                   |
| Claims      | `email`, `roles`, `permissions`, `sid` (session ID), `mfa`  |

### 3.2 Refresh Token Rotation

- Refresh tokens are 48-byte opaque `base64url` values
- Stored as `SHA-256(pepper + ":" + token)` — not plaintext
- Server-side pepper (`REFRESH_TOKEN_PEPPER`) prevents offline brute-force on DB leak
- **Token family** tracking: if a rotated token is replayed, the entire family is revoked
- Each rotation creates a new session row; old token is marked `rotated`

### 3.3 Account Lockout

- **10 consecutive failures** → account locked for **30 minutes**
- Failed attempts are recorded in `login_attempts` with IP, email, UA, timestamp
- Login rate limiter: **5 req/min per IP+email**

### 3.4 MFA (TOTP)

- TOTP with RFC 6238 (30s step, 1-step window for clock drift)
- Secret encrypted at rest with AES-256-GCM (envelope encryption)
- MFA enrollment requires active access token; verification confirms enrollment
- Backup codes: 10 single-use, 10-char base32, stored hashed

---

## 4. Encryption

### 4.1 At-Rest Encryption (AES-256-GCM Envelope)

| Layer                     | Mechanism                              |
| ------------------------- | -------------------------------------- | ---------- | ----------- | -------------- | ----------- |
| KEK (Key Encryption Key)  | 32-byte key from `ENCRYPTION_KEK_B64`  |
| DEK (Data Encryption Key) | 32-byte random per field               |
| Algorithm                 | AES-256-GCM (authenticated encryption) |
| Format                    | `version(1)                            | dataIV(12) | dataTag(16) | wrappedDEK(60) | ciphertext` |
| Key wrapping              | AES-256-GCM wraps DEK with KEK         |

**Encrypted fields:**

- `users.ssn_encrypted`
- `users.mfa_secret_encrypted`
- `accounts.account_number_encrypted`
- `counterparties.account_number_encrypted`
- `wire_transfers.beneficiary_account_enc`

### 4.2 Password / PIN Hashing

| Type             | Algorithm        | Parameters                                           |
| ---------------- | ---------------- | ---------------------------------------------------- |
| Passwords        | Argon2id         | memoryCost=19456 (19 MiB), timeCost=2, parallelism=1 |
| PINs             | Argon2id         | Same parameters                                      |
| Minimum password | 12 characters    |
| PIN format       | Exactly 6 digits |

### 4.3 Transport Encryption

- PostgreSQL: `ssl = 'require'` (TLS with certificate verification by default)
- Redis: Connection via Railway private networking (TLS termination at boundary)
- External APIs: All outbound via HTTPS
- HSTS: `max-age=31536000; includeSubDomains; preload`

---

## 5. Rate Limiting

| Scope             | Window | Max | Key          | Purpose                |
| ----------------- | ------ | --- | ------------ | ---------------------- |
| Global (gateway)  | 60s    | 600 | IP           | DDoS mitigation        |
| Global (core API) | 60s    | 600 | IP           | Per-service ceiling    |
| Login             | 60s    | 5   | IP + email   | Brute-force prevention |
| Transfer          | 60s    | 20  | userId or IP | Transaction abuse      |
| PIN attempts      | 60 min | 10  | userId or IP | PIN enumeration        |

All limiters are backed by Redis (`rate-limit-redis`), ensuring consistency across multiple replicas.

---

## 6. Fraud Detection

### 6.1 Rule Pipeline

| Rule                     | Trigger                             | Score | Severity |
| ------------------------ | ----------------------------------- | ----- | -------- |
| Velocity count           | ≥ 10 txns in 1 hour                 | 35    | High     |
| Velocity amount          | > $50,000 total in 1 hour           | 30    | Medium   |
| Large amount             | ≥ $100,000 single txn               | 40    | High     |
| Medium amount            | ≥ $10,000 single txn                | 20    | Medium   |
| Off-hours                | Transaction outside 05:00–10:00 UTC | 10    | Low      |
| New counterparty + large | Counterparty < 72h old + ≥ $5,000   | 25    | Medium   |

### 6.2 Scoring & Action

- **Flag threshold**: score ≥ 50 → transaction moved to `pending_review`
- Fraud alerts stored in `fraud_alerts` table with severity/rule/details
- Events published to `pine.events.fraud` for real-time admin notification

---

## 7. Database Security (PostgreSQL)

### 7.1 Hardening Measures

- [x] TLS connections enforced (`DATABASE_SSL=require`)
- [x] `pgcrypto` extension for UUID generation only (no application-layer crypto via pg)
- [x] Append-only audit logs (trigger blocks UPDATE/DELETE/TRUNCATE)
- [x] Append-only ledger entries (trigger blocks destructive mutations)
- [x] Double-entry constraint trigger ensures balanced books
- [x] Monthly partitioned audit_logs for retention management
- [x] Numeric columns parsed as strings (no floating-point money)
- [x] Parameterized queries throughout (SQL injection prevention)
- [x] Serializable transaction retry with configurable isolation levels
- [x] Connection pool limits (min 2, max 20) with idle/connection timeouts
- [x] `citext` for case-insensitive email indexing (prevents duplicate accounts)
- [x] Soft deletes with `deleted_at` (data retention compliance)

### 7.2 Recommendations

- [ ] Enable `pg_stat_statements` for query performance monitoring
- [ ] Set `log_min_duration_statement = 1000` to catch slow queries
- [ ] Enable `row_security` for multi-tenant isolation if needed
- [ ] Rotate database credentials quarterly via Railway service variables
- [ ] Enable `pgaudit` extension for DDL change tracking

---

## 8. Redis Security

### 8.1 Current Measures

- [x] Connection via Railway private network (not internet-exposed)
- [x] AUTH via password in `REDIS_URL`
- [x] `enableOfflineQueue: false` (fail-fast when disconnected)
- [x] Rate limit stores prefixed per scope (`pine:rl:*`)
- [x] No sensitive data in Redis values (only counters, pub/sub)

### 8.2 Recommendations

- [ ] Set `maxmemory-policy allkeys-lru` to prevent OOM
- [ ] Enable `rename-command FLUSHALL ""` in production
- [ ] Monitor keyspace notifications for suspicious patterns
- [ ] Set TTLs on all rate-limit keys (already handled by express-rate-limit)

---

## 9. API Security

### 9.1 Headers (Helmet)

- `Content-Security-Policy`: strict default-src self, frame-ancestors none, object-src none
- `Strict-Transport-Security`: 1 year, includeSubDomains, preload
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY (via frame-ancestors none)
- `Referrer-Policy`: strict-origin-when-cross-origin
- `x-powered-by`: disabled

### 9.2 CORS

- Strict origin allowlist from `CORS_ORIGINS` environment variable
- Credentials: true (for cookie-based CSRF)
- Allowed headers: Authorization, Content-Type, Idempotency-Key, X-Request-Id
- Max preflight cache: 600s

### 9.3 CSRF Protection (NEW)

- Double-submit cookie pattern via `__Host-csrf` cookie
- `__Host-` prefix enforces Secure + same-origin
- `SameSite=Strict` blocks cross-origin cookie sending
- State-changing methods (POST/PUT/PATCH/DELETE) require `X-CSRF-Token` header
- Constant-time comparison prevents timing attacks
- Applied to financial endpoints (transfers, withdrawals, PINs, counterparties)

### 9.4 Input Sanitization (NEW)

- Null bytes stripped from all string inputs
- Strings truncated at 10,000 characters
- Nested objects and arrays recursively sanitized
- Defense-in-depth (primary protection via Zod validation + parameterized queries)

### 9.5 Idempotency

- All financial operations require `Idempotency-Key` header
- Unique constraint in database prevents double-processing
- Minimum 8 characters, max 128

---

## 10. RBAC & Authorization

### 10.1 Permission Model

- Role-based with fine-grained permissions (`resource:action`)
- Wildcard support (`*:*` for admin)
- Permissions embedded in JWT claims (no DB lookup per request)
- Role assignment audit-logged with granting user

### 10.2 Roles

- `customer` — basic account operations
- `support` — user lookup, PIN issuance
- `compliance_officer` — case management, SAR filing
- `admin` — all operations
- `super_admin` — system settings, key rotation

---

## 11. Audit & Compliance

### 11.1 Audit Logging

- Append-only table (trigger-enforced, no UPDATE/DELETE)
- Monthly partitioned for retention management
- Captures: actor, role, action, resource, before/after state, IP, UA, request ID
- Indexed by actor, resource, action, time

### 11.2 Compliance Framework

- KYC status tracking (pending/approved/rejected/review)
- Compliance cases (KYC/AML/SAR/CTR) with evidence trail
- Wire review threshold ($25,000) for high-value wire compliance
- Transaction monitoring via fraud engine
- Monthly statement generation with PDF storage

---

## 12. Threat Model

| Threat                 | Mitigation                                   | Residual Risk         |
| ---------------------- | -------------------------------------------- | --------------------- |
| Credential stuffing    | Rate limiting + account lockout + MFA        | Low                   |
| Session hijacking      | Short-lived JWT + rotation + family tracking | Low                   |
| Token theft (refresh)  | Hashed storage + pepper + reuse detection    | Low                   |
| SQL injection          | Parameterized queries + Zod validation       | Negligible            |
| XSS                    | React auto-escape + CSP + sanitization       | Low                   |
| CSRF                   | Double-submit cookie + SameSite=Strict       | Low                   |
| Data exfiltration (DB) | AES-256-GCM column encryption                | Medium (KEK exposure) |
| Insider threat         | RBAC + audit logs + MFA for admin            | Medium                |
| DDoS                   | Multi-layer rate limiting + Railway scaling  | Medium                |
| Fraud                  | Multi-rule scoring + review holds            | Low-Medium            |

---

## 13. Railway Production Hardening

### 13.1 Deployment Config

```json
{
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/healthz",
    "healthcheckTimeout": 30
  }
}
```

### 13.2 Checklist

- [x] Health checks (`/healthz` liveness, `/readyz` readiness with DB+Redis)
- [x] Graceful shutdown handlers (SIGTERM/SIGINT)
- [x] Trust proxy enabled for Railway's reverse proxy
- [x] Service-to-service on Railway private network
- [x] Environment variable secrets (never in code)
- [x] `NODE_ENV=production` enforcement for secret validation
- [x] Connection pool cleanup on shutdown
- [x] Outbox relay stop on shutdown

### 13.3 Recommendations

- [ ] Enable Railway's built-in DDoS protection
- [ ] Configure Railway restart delay (exponential backoff)
- [ ] Set memory limits per service to prevent OOM cascade
- [ ] Use Railway's private networking for all inter-service communication
- [ ] Enable Railway observability (metrics + logs + traces)

---

## 14. Penetration Testing Guidance

### 14.1 Authentication Tests

1. Attempt login with > 10 bad passwords → verify lockout
2. Replay a rotated refresh token → verify family revocation
3. Use expired access token → verify 401
4. Omit MFA code with MFA-enabled account → verify rejection
5. Send access token in cookie (not header) → verify rejection

### 14.2 Authorization Tests

1. Customer attempts admin endpoint → verify 403
2. Customer accesses another user's account → verify 404/403
3. Missing permission for transfer → verify 403
4. Attempt PIN-less transfer → verify rejection

### 14.3 Injection Tests

1. SQL injection in query params (`'; DROP TABLE--`) → verify no effect
2. XSS in memo/description fields → verify stored as-is, rendered escaped
3. Null bytes in input → verify stripped
4. Oversized body (> 256KB) → verify 413
5. Oversized individual fields (> 10KB) → verify truncated

### 14.4 Business Logic Tests

1. Transfer to same account → verify rejection
2. Transfer exceeding balance → verify rejection
3. PIN reuse after consumption → verify rejection
4. Idempotency key replay → verify same response (not double-debit)
5. Concurrent transfers racing to zero balance → verify serialization

### 14.5 Rate Limit Tests

1. > 5 login attempts/minute → verify 429
2. > 20 transfer attempts/minute → verify 429
3. > 10 PIN attempts/hour → verify 429
4. > 600 requests/minute from one IP → verify 429

---

## 15. Secure Coding Standards

### 15.1 Mandatory Practices

- All DB queries use parameterized placeholders (`$1, $2, ...`)
- All user input validated with Zod schemas before processing
- All financial operations within database transactions
- All sensitive fields encrypted before storage
- All audit-worthy actions logged to append-only audit table
- All error responses use RFC 7807 Problem Details format
- All secrets loaded from environment, never hardcoded
- All HTTP responses include security headers via Helmet

### 15.2 Prohibited Patterns

- No string concatenation in SQL
- No `eval()` or `Function()` constructors
- No secrets in log output (enforced by pino redaction)
- No floating-point arithmetic for money (NUMERIC(20,4) + string parsing)
- No DELETE operations on ledger_entries or audit_logs
- No access to other users' resources without admin role check
- No synchronous crypto operations in request path (except hash compare)

---

## 16. Key Rotation Procedures

| Key                  | Rotation Method                         | Frequency     |
| -------------------- | --------------------------------------- | ------------- |
| JWT RS256 keys       | `npm run rotate-keys` script            | Quarterly     |
| Encryption KEK       | Deploy new KEK, re-encrypt columns      | Annually      |
| Refresh token pepper | Update env var, invalidate all sessions | On compromise |
| Database credentials | Railway service variable update         | Quarterly     |
| Redis password       | Railway service variable update         | Quarterly     |

---

## 17. Monitoring & Alerting Recommendations

| Signal                        | Threshold        | Action                      |
| ----------------------------- | ---------------- | --------------------------- |
| Failed logins (per user)      | > 5 in 5 min     | Alert + temporary lock      |
| Rate limit violations         | > 100 in 1 min   | Alert + IP investigation    |
| Fraud score ≥ 50              | Any              | Hold transaction + alert    |
| 5xx error rate                | > 1% of traffic  | Alert + investigation       |
| DB connection pool exhaustion | pool.waiting > 5 | Scale pool / investigate    |
| Session family revocation     | Any              | Alert (token theft attempt) |
| Admin action without MFA      | Any              | Alert + block               |

---

_Document Version: 1.0.0 — Last Updated: 2026-05-25_
