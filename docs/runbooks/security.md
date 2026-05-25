# Security runbook

## Key rotation

- **JWT keypair**: run `node scripts/rotate-keys.js` to emit new
  `JWT_PRIVATE_KEY_B64` / `JWT_PUBLIC_KEY_B64`. Update Railway variables
  for **every** Node service in a single batch (verifiers need the new
  public key in lock-step). Existing access tokens expire on their own
  within `JWT_ACCESS_TTL_SECONDS` (default 10 min). Refresh tokens are
  unaffected (they live in DB, not signed).

- **Encryption KEK** (`ENCRYPTION_KEK_B64`): rotating this is a heavier
  migration because every encrypted column row stores a DEK wrapped by the
  KEK. The envelope format (`packages/lib-crypto`) supports a version byte
  so future code can decrypt under the old KEK and re-encrypt under the
  new one. Until that migration is implemented, do **not** rotate the KEK.

- **Refresh-token pepper**: rotating invalidates lookup of existing
  refresh tokens. Run:

  ```sql
  UPDATE sessions
     SET revoked_at = now(), revoked_reason = 'pepper_rotation'
   WHERE revoked_at IS NULL;
  ```

  immediately after the variable change.

## Incident response — suspected token theft

```sql
-- Revoke a single user's sessions
UPDATE sessions SET revoked_at = now(), revoked_reason = 'incident'
 WHERE user_id = '<uuid>' AND revoked_at IS NULL;

-- Lock the user out
UPDATE users SET locked_until = now() + interval '24 hours' WHERE id = '<uuid>';
```

## Reuse-detection breakage

If `sessions.rotated_from` indicates a refresh-token replay attempt, the
session **family** is automatically revoked and the user is forced to
re-authenticate. Audit query:

```sql
SELECT s.user_id, s.family_id, s.revoked_reason, s.created_at
  FROM sessions s
 WHERE s.revoked_reason = 'refresh_reuse'
 ORDER BY s.created_at DESC
 LIMIT 100;
```

## Admin domain protections

- `admin-api` enforces `ADMIN_IP_ALLOWLIST` at the application layer.
- Cloudflare in front adds WAF + Bot Management + IP allowlist + mTLS as
  defence in depth.
- TOTP MFA is mandatory for any role other than `customer`.
