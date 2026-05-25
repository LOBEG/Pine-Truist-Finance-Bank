-- =====================================================================
-- 0003_audit_compliance.sql
-- Append-only audit logs (monthly partitioned), notifications, fraud,
-- compliance cases, statements, system settings, devices.
-- =====================================================================

-- ----- notifications outbox -----
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('email','sms','push','inapp')),
  template    TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','sent','failed','suppressed')),
  sent_at     TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications(status);

-- ----- audit logs (partitioned by month, append-only) -----
CREATE TABLE IF NOT EXISTS audit_logs (
  id               UUID NOT NULL DEFAULT gen_random_uuid(),
  actor_user_id    UUID,
  actor_role       TEXT,
  action           TEXT NOT NULL,
  resource_type    TEXT,
  resource_id      TEXT,
  before           JSONB,
  after            JSONB,
  ip               INET,
  user_agent       TEXT,
  request_id       TEXT,
  correlation_id   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create rolling partitions: previous month + current + next 2.
DO $$
DECLARE
  base date := date_trunc('month', now())::date - INTERVAL '1 month';
  i int;
  start_dt date;
  end_dt date;
  part_name text;
BEGIN
  FOR i IN 0..3 LOOP
    start_dt := (base + (i || ' month')::interval)::date;
    end_dt   := (start_dt + INTERVAL '1 month')::date;
    part_name := 'audit_logs_' || to_char(start_dt, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L);',
      part_name, start_dt, end_dt
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS audit_actor_time_idx
  ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_resource_idx
  ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_action_idx
  ON audit_logs(action, created_at DESC);

-- Append-only enforcement: block UPDATE / DELETE.
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% blocked)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();

-- ----- fraud alerts -----
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  transaction_id  UUID REFERENCES transactions(id),
  rule            TEXT NOT NULL,
  score           NUMERIC(5,2) NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','cleared','confirmed')),
  cleared_by      UUID REFERENCES users(id),
  cleared_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fraud_alerts_open_idx ON fraud_alerts(created_at DESC) WHERE status = 'open';

-- ----- device fingerprints / user devices -----
CREATE TABLE IF NOT EXISTS user_devices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint        TEXT NOT NULL,
  name               TEXT,
  ip                 INET,
  user_agent         TEXT,
  trusted            BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

-- ----- rate-limit violations (cold storage from Redis) -----
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id          BIGSERIAL PRIMARY KEY,
  scope       TEXT NOT NULL,
  identifier  TEXT NOT NULL,
  ip          INET,
  user_id     UUID,
  count       INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_violations_time_idx ON rate_limit_violations(created_at DESC);

-- ----- compliance cases (KYC/AML/SAR/CTR) -----
CREATE TABLE IF NOT EXISTS compliance_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  case_type       TEXT NOT NULL CHECK (case_type IN ('KYC','AML','SAR','CTR')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','closed','reported')),
  opened_by       UUID REFERENCES users(id),
  assigned_to     UUID REFERENCES users(id),
  notes           TEXT,
  evidence_keys   TEXT[],
  amount          NUMERIC(20,4),
  related_transaction_id UUID REFERENCES transactions(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS compliance_status_idx ON compliance_cases(status);
CREATE INDEX IF NOT EXISTS compliance_user_idx ON compliance_cases(user_id);

-- ----- statements (PDF references) -----
CREATE TABLE IF NOT EXISTS statements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  opening_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  pdf_object_key  TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, period_start, period_end)
);

-- ----- system settings -----
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- consumer dedup table (for Redis event consumers) -----
CREATE TABLE IF NOT EXISTS consumer_dedup (
  consumer    TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);
CREATE INDEX IF NOT EXISTS consumer_dedup_time_idx ON consumer_dedup(processed_at);
