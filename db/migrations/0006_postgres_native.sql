-- =====================================================================
-- 0006_postgres_native.sql
-- Postgres-native infrastructure to eliminate Redis dependency:
--   1. pg_boss schema (job queue)
--   2. Advisory lock helpers
--   3. Rate limiting table
--   4. LISTEN/NOTIFY pub/sub channels
--   5. Notification delivery confirmation & DLQ
--   6. account_balances cached table (instead of VIEW)
--   7. External rails configuration flag
-- =====================================================================

-- ----- pg_boss schema placeholder -----
-- pg_boss creates its own schema on first boot. We just ensure the extension.
-- Note: pg_boss handles its own migrations; this is a placeholder for docs.

-- ----- advisory lock registry (documentation) -----
-- Advisory locks used by workers:
--   1. scheduler singleton: pg_advisory_lock(8675309, 1)
--   2. outbox relay: pg_advisory_lock(8675309, 2)
--   3. reconciliation job: pg_advisory_lock(8675309, 3)
COMMENT ON DATABASE current_database IS 'Advisory lock IDs: 8675309,1=scheduler; 8675309,2=outbox; 8675309,3=reconcile';

-- ----- rate_limits table (replaces Redis rate limiting) -----
CREATE TABLE IF NOT EXISTS rate_limits (
  key         TEXT NOT NULL,
  points      INT NOT NULL DEFAULT 0,
  expire_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key)
);
CREATE INDEX IF NOT EXISTS rate_limits_expire_idx ON rate_limits(expire_at);

-- Cleanup function for expired rate limit entries (run by scheduler)
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE expire_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ----- notification_deliveries (delivery confirmation & DLQ) -----
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('postmark', 'twilio', 'log')),
  provider_id     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  attempts        INT NOT NULL DEFAULT 0,
  last_error      TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx 
  ON notification_deliveries(status, created_at) WHERE status IN ('pending', 'failed');

-- ----- notification DLQ (dead letter queue) -----
CREATE TABLE IF NOT EXISTS notification_dlq (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_dlq_time_idx ON notification_dlq(created_at DESC);

-- ----- external_rails_config (controls real vs disabled rails) -----
-- If no row exists or enabled=false, external ACH/wire rails are DISABLED.
-- The system will reject external transfers with 'external_rails_disabled'.
CREATE TABLE IF NOT EXISTS external_rails_config (
  provider        TEXT PRIMARY KEY,
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_verified   TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default disabled state for all external providers
INSERT INTO external_rails_config (provider, enabled, config)
VALUES 
  ('ach', FALSE, '{"note": "No ACH provider configured. External ACH transfers disabled."}'),
  ('wire', FALSE, '{"note": "No wire provider configured. External wire transfers disabled."}')
ON CONFLICT (provider) DO NOTHING;

-- ----- account_balances_cache (materialized cache, not VIEW) -----
-- This table is updated by triggers on ledger_entries for performance.
-- The existing VIEW remains as account_balances for backward compatibility.

CREATE TABLE IF NOT EXISTS account_balances_cache (
  account_id       UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  available_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  ledger_balance   NUMERIC(20,4) NOT NULL DEFAULT 0,
  pending_debits   NUMERIC(20,4) NOT NULL DEFAULT 0,
  pending_credits  NUMERIC(20,4) NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Initialize cache from current ledger state
INSERT INTO account_balances_cache (account_id, available_balance, ledger_balance, pending_debits, pending_credits)
SELECT 
  a.id,
  account_available_balance(a.id),
  account_ledger_balance(a.id),
  COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE account_id = a.id AND direction='debit' AND status='pending'), 0),
  COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE account_id = a.id AND direction='credit' AND status='pending'), 0)
FROM accounts a
ON CONFLICT (account_id) DO UPDATE SET
  available_balance = EXCLUDED.available_balance,
  ledger_balance = EXCLUDED.ledger_balance,
  pending_debits = EXCLUDED.pending_debits,
  pending_credits = EXCLUDED.pending_credits,
  updated_at = now();

-- Trigger function to update cache on ledger changes
CREATE OR REPLACE FUNCTION update_balance_cache() RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
BEGIN
  v_account_id := COALESCE(NEW.account_id, OLD.account_id);
  
  INSERT INTO account_balances_cache (account_id, available_balance, ledger_balance, pending_debits, pending_credits)
  VALUES (
    v_account_id,
    account_available_balance(v_account_id),
    account_ledger_balance(v_account_id),
    COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE account_id = v_account_id AND direction='debit' AND status='pending'), 0),
    COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE account_id = v_account_id AND direction='credit' AND status='pending'), 0)
  )
  ON CONFLICT (account_id) DO UPDATE SET
    available_balance = EXCLUDED.available_balance,
    ledger_balance = EXCLUDED.ledger_balance,
    pending_debits = EXCLUDED.pending_debits,
    pending_credits = EXCLUDED.pending_credits,
    updated_at = now();
  
  -- Notify listeners of balance update (replaces Redis pub/sub for balances)
  PERFORM pg_notify('balance_updated', json_build_object(
    'account_id', v_account_id,
    'available_balance', account_available_balance(v_account_id)::text,
    'ledger_balance', account_ledger_balance(v_account_id)::text
  )::text);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_update_balance_cache ON ledger_entries;
CREATE TRIGGER ledger_update_balance_cache
  AFTER INSERT OR UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION update_balance_cache();

-- ----- job_queue table for pg-boss-like functionality -----
-- This provides a simple fallback if pg-boss isn't available
CREATE TABLE IF NOT EXISTS job_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name      TEXT NOT NULL,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  state           TEXT NOT NULL DEFAULT 'created'
                    CHECK (state IN ('created', 'active', 'completed', 'failed', 'cancelled')),
  priority        INT NOT NULL DEFAULT 0,
  retry_count     INT NOT NULL DEFAULT 0,
  max_retries     INT NOT NULL DEFAULT 5,
  retry_delay_sec INT NOT NULL DEFAULT 60,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expire_at       TIMESTAMPTZ,
  output          JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_queue_pending_idx 
  ON job_queue(queue_name, priority DESC, created_at) 
  WHERE state = 'created';
CREATE INDEX IF NOT EXISTS job_queue_retry_idx 
  ON job_queue(queue_name, created_at) 
  WHERE state = 'failed' AND retry_count < max_retries;

-- Function to claim a job atomically
CREATE OR REPLACE FUNCTION claim_job(p_queue_name TEXT, p_limit INT DEFAULT 1)
RETURNS TABLE (
  job_id UUID,
  job_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM job_queue
    WHERE queue_name = p_queue_name AND state = 'created'
    ORDER BY priority DESC, created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE job_queue j
  SET state = 'active', started_at = now()
  FROM claimed c
  WHERE j.id = c.id
  RETURNING j.id AS job_id, j.data AS job_data;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a job
CREATE OR REPLACE FUNCTION complete_job(p_job_id UUID, p_output JSONB DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE job_queue
  SET state = 'completed', completed_at = now(), output = p_output
  WHERE id = p_job_id AND state = 'active';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to fail a job (with automatic retry if under max)
CREATE OR REPLACE FUNCTION fail_job(p_job_id UUID, p_error TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_retry_count INT;
  v_max_retries INT;
BEGIN
  SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
  FROM job_queue WHERE id = p_job_id;
  
  IF v_retry_count < v_max_retries THEN
    UPDATE job_queue
    SET state = 'created', -- Back to created for retry
        retry_count = retry_count + 1,
        error = p_error,
        started_at = NULL
    WHERE id = p_job_id;
  ELSE
    UPDATE job_queue
    SET state = 'failed', completed_at = now(), error = p_error
    WHERE id = p_job_id;
  END IF;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ----- socket_io_attachments (required by @socket.io/postgres-adapter) -----
-- This table is used by the Socket.IO Postgres adapter for cross-server coordination.
CREATE TABLE IF NOT EXISTS socket_io_attachments (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload     BYTEA
);
