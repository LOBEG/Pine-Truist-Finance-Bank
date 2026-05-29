# Admin Bootstrap Documentation

## Overview

The admin bootstrap service provides secure, one-time initialization of the
first administrator user at server startup. This eliminates the need for
manual CLI commands during Railway deployment while maintaining security.

**Key Security Invariant**: Environment credentials (`ADMIN_EMAIL`,
`ADMIN_PASSWORD`) are used **ONLY** for one-time user creation at startup.
They are **NEVER** used for login authentication. Login always authenticates
against the database password hash using Argon2id verification.

## Environment Variables

| Variable                  | Required | Description                                        |
| ------------------------- | -------- | -------------------------------------------------- |
| `ADMIN_BOOTSTRAP_ENABLED` | Yes      | Must be exactly `'true'` to enable bootstrap       |
| `ADMIN_EMAIL`             | Yes      | Admin user email (validated for format)            |
| `ADMIN_PASSWORD`          | Yes      | Initial password (see strength requirements below) |

### Password Requirements

- Minimum 16 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)

Example of a compliant password: `SecureAdmin2024Password!`

## Behavior

### When Bootstrap Runs

1. Server starts (core-banking-api)
2. Database connection established
3. pg-boss queue initialized
4. **Bootstrap service executes** (before HTTP server starts listening)
5. HTTP server starts

### Bootstrap Logic

```
IF ADMIN_BOOTSTRAP_ENABLED !== 'true':
    Log "bootstrap skipped: disabled" and return

IF ADMIN_EMAIL invalid format:
    Log error and exit process with code 1

IF ADMIN_PASSWORD doesn't meet requirements:
    Log error and exit process with code 1

BEGIN TRANSACTION:
    ACQUIRE pg_advisory_xact_lock(8675309, 100)  -- Prevents race conditions

    IF user with role 'admin' or 'super_admin' exists:
        Log "admin bootstrap skipped: admin already present"
        RETURN (no-op)

    Hash password with Argon2id
    INSERT user with email, password_hash, role binding

COMMIT

Log "admin bootstrap completed"
Zero out password from memory
```

### Security Features

1. **Advisory Lock**: Prevents race conditions when multiple instances start
   simultaneously. Only one instance creates the admin.

2. **ON CONFLICT DO NOTHING**: Ensures idempotency — running bootstrap twice
   with the same email doesn't cause errors.

3. **Memory Zeroing**: Password is cleared from process memory after hashing
   (best-effort in JavaScript).

4. **Never Logged**: Plaintext password is never written to logs.

5. **Fail-Fast**: Invalid credentials cause immediate process exit with code 1,
   preventing a misconfigured server from starting.

## Railway Deployment Steps

### First Deployment

1. In Railway dashboard, add these env vars to `core-banking-api`:

   ```
   ADMIN_BOOTSTRAP_ENABLED=true
   ADMIN_EMAIL=admin@yourcompany.com
   ADMIN_PASSWORD=YourSecure16CharPassword123
   ```

2. Deploy the service. Check logs for:

   ```
   admin bootstrap completed: super_admin user created
   ```

3. **Immediately after successful deployment**, update env vars:

   ```
   ADMIN_BOOTSTRAP_ENABLED=false
   ```

   Or remove the variable entirely.

4. Login at your admin portal with the credentials. You will be required to:
   - Change your password on first login
   - Enroll in MFA (mandatory for admin users)

### Subsequent Deployments

After the first admin exists, bootstrap automatically skips:

```
admin bootstrap skipped: admin already present
```

No action required. Even if `ADMIN_BOOTSTRAP_ENABLED=true` is accidentally
left set, the existing admin is never modified.

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      BOOTSTRAP (startup)                         │
│  ADMIN_EMAIL + ADMIN_PASSWORD → hash → INSERT into users table  │
│                         (one-time only)                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LOGIN (runtime)                             │
│  POST /api/v1/auth/login                                        │
│  { email, password } → SELECT password_hash FROM users →        │
│                        argon2.verify(password_hash, password)    │
│                                                                  │
│  ⚠️  NEVER compares against process.env.ADMIN_PASSWORD          │
└─────────────────────────────────────────────────────────────────┘
```

## Security Audit Checklist

- [ ] `ADMIN_BOOTSTRAP_ENABLED` is `false` or unset in production after first deploy
- [ ] `ADMIN_PASSWORD` is not committed to source control
- [ ] Admin has enrolled MFA (required for all admin endpoints)
- [ ] Admin IP allowlist is configured (`ADMIN_IP_ALLOWLIST`)
- [ ] Login attempts are rate-limited (automatic)

## Troubleshooting

### "admin bootstrap failed: ADMIN_EMAIL is missing or invalid format"

The email is either not set or doesn't match email format validation.

**Fix**: Set a valid email address in `ADMIN_EMAIL`.

### "admin bootstrap failed: ADMIN_PASSWORD is missing or too weak"

Password doesn't meet the 16-character minimum or complexity requirements.

**Fix**: Use a password with:

- At least 16 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

### Bootstrap runs but admin can't login

1. Verify the user was created:

   ```sql
   SELECT email, mfa_enabled, must_change_password
   FROM users u
   JOIN user_roles ur ON ur.user_id = u.id
   JOIN roles r ON r.id = ur.role_id
   WHERE r.name = 'super_admin';
   ```

2. If user exists, verify password hash format starts with `$argon2id$`

3. Check rate limiting — too many failed attempts lock the account

### "admin bootstrap skipped: admin already present"

This is expected behavior. An admin already exists in the database. Bootstrap
will not create a second admin or modify the existing one.

## Manual Admin Creation (Alternative)

For environments where automatic bootstrap isn't suitable:

```bash
ADMIN_EMAIL=admin@yourcompany.com \
ADMIN_PASSWORD='YourSecure16CharPassword123' \
node scripts/create-admin.js
```

This script can also upgrade an existing user to super_admin role.

## Related Documentation

- [Deployment Runbook](runbooks/deploy.md) — Full deployment guide
- [Security Architecture](SECURITY_ARCHITECTURE.md) — System security design
- [Production Readiness](production-readiness.md) — Go-live checklist
