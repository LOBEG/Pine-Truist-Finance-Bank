-- =====================================================================
-- Pine Bank — 0001_init.sql
-- Core schema: extensions, users, roles, sessions, accounts.
-- All migrations are idempotent (IF NOT EXISTS) and use uuid PKs.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ----- migrations tracking -----
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- users -----
CREATE TABLE IF NOT EXISTS users (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                     CITEXT NOT NULL UNIQUE,
  password_hash             TEXT NOT NULL,
  full_name                 TEXT NOT NULL,
  phone                     TEXT,
  date_of_birth             DATE,
  ssn_encrypted             TEXT,
  kyc_status                TEXT NOT NULL DEFAULT 'pending'
                              CHECK (kyc_status IN ('pending','approved','rejected','review')),
  mfa_secret_encrypted      TEXT,
  mfa_enabled               BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_backup_codes_hashed   TEXT[],
  failed_login_count        INT NOT NULL DEFAULT 0,
  locked_until              TIMESTAMPTZ,
  last_login_at             TIMESTAMPTZ,
  password_changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  must_change_password      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS users_kyc_status_idx ON users(kyc_status);
CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users(deleted_at) WHERE deleted_at IS NULL;

-- ----- RBAC -----
CREATE TABLE IF NOT EXISTS roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource   TEXT NOT NULL,
  action     TEXT NOT NULL,
  description TEXT,
  UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- ----- sessions / refresh tokens (rotating) -----
CREATE TABLE IF NOT EXISTS sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash   TEXT NOT NULL UNIQUE,
  family_id            UUID NOT NULL,
  rotated_from         UUID REFERENCES sessions(id),
  device_fingerprint   TEXT,
  ip                   INET,
  user_agent           TEXT,
  expires_at           TIMESTAMPTZ NOT NULL,
  revoked_at           TIMESTAMPTZ,
  revoked_reason       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_family_idx   ON sessions(family_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx  ON sessions(expires_at);

-- ----- login attempts -----
CREATE TABLE IF NOT EXISTS login_attempts (
  id              BIGSERIAL PRIMARY KEY,
  email           CITEXT,
  ip              INET,
  success         BOOLEAN NOT NULL,
  failure_reason  TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_time_idx ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_ip_time_idx    ON login_attempts(ip, created_at DESC);

-- ----- accounts -----
CREATE TABLE IF NOT EXISTS accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  account_number_encrypted TEXT NOT NULL,
  account_number_last4     CHAR(4) NOT NULL,
  routing_number           CHAR(9) NOT NULL,
  account_type             TEXT NOT NULL
                             CHECK (account_type IN
                               ('checking','savings','money_market','cd','investment')),
  nickname                 TEXT,
  currency                 CHAR(3) NOT NULL DEFAULT 'USD',
  status                   TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','frozen','closed')),
  opened_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_user_idx       ON accounts(user_id);
CREATE INDEX IF NOT EXISTS accounts_last4_idx      ON accounts(account_number_last4);
CREATE INDEX IF NOT EXISTS accounts_status_idx     ON accounts(status);

-- ----- updated_at triggers -----
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS accounts_set_updated_at ON accounts;
CREATE TRIGGER accounts_set_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
