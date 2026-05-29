-- =====================================================================
-- 0004_functions_triggers.sql
-- Double-entry invariant trigger, balance functions, append-only ledger,
-- statement-balance computation.
-- =====================================================================

-- ----- double-entry invariant -----
-- Sum of posted credits == sum of posted debits per transaction id.
-- Pending entries are excluded (they are holds that don't have a counter-leg yet).

CREATE OR REPLACE FUNCTION enforce_double_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_tx UUID := COALESCE(NEW.transaction_id, OLD.transaction_id);
  v_txn_status TEXT;
  v_sum NUMERIC(20,4);
BEGIN
  -- Look up final transaction status. If still pending, defer the check.
  SELECT status INTO v_txn_status FROM transactions WHERE id = v_tx;
  IF v_txn_status IS NULL OR v_txn_status IN ('pending','authorized','pending_review','cancelled','failed') THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN direction = 'credit' THEN amount ELSE -amount END
  ), 0)
  INTO v_sum
  FROM ledger_entries
  WHERE transaction_id = v_tx AND status = 'posted';

  IF v_sum <> 0 THEN
    RAISE EXCEPTION 'Double-entry violation for transaction %: sum=%', v_tx, v_sum;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_double_entry_check ON ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_double_entry_check
  AFTER INSERT OR UPDATE ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_double_entry();

-- ----- ledger append-only -----
-- Allow UPDATE only to flip pending->posted/released/reversed; block DELETE.
CREATE OR REPLACE FUNCTION ledger_no_destructive()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ledger_entries are append-only';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.amount        <> OLD.amount
       OR NEW.direction  <> OLD.direction
       OR NEW.account_id <> OLD.account_id
       OR NEW.transaction_id <> OLD.transaction_id
       OR NEW.currency   <> OLD.currency THEN
      RAISE EXCEPTION 'ledger_entries immutable fields cannot change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_no_destructive_t ON ledger_entries;
CREATE TRIGGER ledger_no_destructive_t
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_no_destructive();

-- ----- canonical balance function -----
CREATE OR REPLACE FUNCTION account_available_balance(p_account_id UUID)
RETURNS NUMERIC(20,4) AS $$
DECLARE
  v_posted NUMERIC(20,4);
  v_pending_debit NUMERIC(20,4);
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN direction='credit' AND status='posted' THEN amount
                      WHEN direction='debit'  AND status='posted' THEN -amount
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction='debit' AND status='pending' THEN amount ELSE 0 END), 0)
  INTO v_posted, v_pending_debit
  FROM ledger_entries WHERE account_id = p_account_id;

  RETURN v_posted - v_pending_debit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION account_ledger_balance(p_account_id UUID)
RETURNS NUMERIC(20,4) AS $$
  SELECT COALESCE(SUM(
    CASE WHEN direction='credit' AND status='posted' THEN amount
         WHEN direction='debit'  AND status='posted' THEN -amount
         ELSE 0 END), 0)
  FROM ledger_entries WHERE account_id = $1;
$$ LANGUAGE SQL STABLE;

-- ----- materialized-style balance cache view (live) -----
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id AS account_id,
  a.user_id,
  a.account_type,
  a.currency,
  account_available_balance(a.id) AS available_balance,
  account_ledger_balance(a.id)    AS ledger_balance,
  COALESCE((SELECT SUM(amount) FROM ledger_entries
            WHERE account_id = a.id AND direction='debit' AND status='pending'), 0) AS pending_debits,
  COALESCE((SELECT SUM(amount) FROM ledger_entries
            WHERE account_id = a.id AND direction='credit' AND status='pending'), 0) AS pending_credits
FROM accounts a;
