-- Align the shared rate limit table with rate-limiter-flexible's Postgres schema.
-- Earlier deployments created expire_at as TIMESTAMPTZ, but the library reads
-- and writes an expire BIGINT in epoch milliseconds.

ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS expire BIGINT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'rate_limits'
      AND column_name = 'expire_at'
  ) THEN
    UPDATE rate_limits
    SET expire = (EXTRACT(EPOCH FROM expire_at) * 1000)::BIGINT
    WHERE expire IS NULL;

    ALTER TABLE rate_limits ALTER COLUMN expire_at DROP NOT NULL;
  END IF;
END;
$$;

DROP INDEX IF EXISTS rate_limits_expire_idx;
CREATE INDEX IF NOT EXISTS rate_limits_expire_idx ON rate_limits(expire);

CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE expire < (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
