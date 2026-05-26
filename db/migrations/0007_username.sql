-- =====================================================================
-- Pine Bank — 0007_username.sql
-- Adds username-based login support and extended onboarding fields.
--
-- NOTE: login_attempts.email column is re-used to store usernames for
-- login audit records. The column name is kept to avoid a breaking
-- rename; new rows from username-based login store the username string
-- in that column, which preserves the existing indexes and queries.
-- =====================================================================

-- username (CITEXT for case-insensitive comparison, unique when present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username CITEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username) WHERE username IS NOT NULL;

-- address fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line1   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line2   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city            TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state           CHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code     TEXT;

-- security question / answer (answer is argon2-hashed)
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_question      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer_hash   TEXT;
