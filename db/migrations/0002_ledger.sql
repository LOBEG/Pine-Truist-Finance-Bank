-- =====================================================================
-- 0002_ledger.sql
-- Double-entry ledger, transactions, counterparties, PINs, withdrawals,
-- ACH/wire detail tables, outbox.
-- =====================================================================

-- ----- transactions (header) -----
CREATE TABLE IF NOT EXISTS transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref             TEXT,
  type                     TEXT NOT NULL
                             CHECK (type IN
                               ('deposit','withdrawal','internal_transfer',
                                'ach_credit','ach_debit','wire_domestic',
                                'fee','interest','reversal','adjustment')),
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN
                               ('pending','authorized','posted','settled',
                                'failed','reversed','pending_review','cancelled')),
  source_account_id        UUID REFERENCES accounts(id),
  destination_account_id   UUID REFERENCES accounts(id),
  counterparty_id          UUID,
  amount                   NUMERIC(20,4) NOT NULL CHECK (amount >= 0),
  currency                 CHAR(3) NOT NULL DEFAULT 'USD',
  description              TEXT,
  memo                     TEXT,
  idempotency_key          TEXT NOT NULL UNIQUE,
  initiated_by_user_id     UUID REFERENCES users(id),
  authorized_by_admin_id   UUID REFERENCES users(id),
  pin_authorization_id     UUID,
  fraud_score              NUMERIC(5,2),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at                TIMESTAMPTZ,
  settled_at               TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS txn_source_posted_idx
  ON transactions(source_account_id, posted_at DESC) WHERE source_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS txn_dest_posted_idx
  ON transactions(destination_account_id, posted_at DESC) WHERE destination_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS txn_status_idx ON transactions(status);
CREATE INDEX IF NOT EXISTS txn_type_idx   ON transactions(type);
CREATE INDEX IF NOT EXISTS txn_initiator_idx ON transactions(initiated_by_user_id);

-- ----- ledger entries (append-only, double-entry) -----
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  account_id      UUID NOT NULL REFERENCES accounts(id),
  direction       TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  amount          NUMERIC(20,4) NOT NULL CHECK (amount > 0),
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'posted'
                    CHECK (status IN ('pending','posted','released','reversed')),
  posted_at       TIMESTAMPTZ,
  value_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_account_posted_idx
  ON ledger_entries(account_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS ledger_txn_idx ON ledger_entries(transaction_id);

-- ----- transaction state-machine event history -----
CREATE TABLE IF NOT EXISTS transaction_events (
  id             BIGSERIAL PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS txn_events_txn_idx ON transaction_events(transaction_id);

-- ----- counterparties (external bank linkage) -----
CREATE TABLE IF NOT EXISTS counterparties (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  bank_name                TEXT NOT NULL,
  routing_number           CHAR(9) NOT NULL,
  account_number_encrypted TEXT NOT NULL,
  account_number_last4     CHAR(4) NOT NULL,
  account_type             TEXT NOT NULL CHECK (account_type IN ('checking','savings')),
  country                  CHAR(2) NOT NULL DEFAULT 'US',
  verified                 BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS counterparties_user_idx ON counterparties(user_id) WHERE deleted_at IS NULL;

-- ----- transfer PINs (admin-issued, single-use, argon2id-hashed) -----
CREATE TABLE IF NOT EXISTS transfer_pins (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_hash               TEXT NOT NULL,
  purpose                TEXT NOT NULL
                           CHECK (purpose IN
                             ('internal_transfer','ach_transfer','wire_transfer',
                              'withdrawal','generic')),
  transaction_id         UUID REFERENCES transactions(id),
  generated_by_admin_id  UUID NOT NULL REFERENCES users(id),
  expires_at             TIMESTAMPTZ NOT NULL,
  consumed_at            TIMESTAMPTZ,
  attempts               INT NOT NULL DEFAULT 0,
  max_attempts           INT NOT NULL DEFAULT 3,
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','consumed','expired','revoked')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pins_user_active_idx ON transfer_pins(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS pins_expiry_idx     ON transfer_pins(expires_at) WHERE status = 'active';

ALTER TABLE transactions
  ADD CONSTRAINT transactions_pin_fk
  FOREIGN KEY (pin_authorization_id) REFERENCES transfer_pins(id)
  DEFERRABLE INITIALLY DEFERRED;

-- ----- withdrawal requests -----
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  account_id                  UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount                      NUMERIC(20,4) NOT NULL CHECK (amount > 0),
  method                      TEXT NOT NULL
                                CHECK (method IN ('cash','check','ach_external','wire')),
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN
                                  ('pending','approved','rejected','disbursed','cancelled')),
  notes                       TEXT,
  hold_transaction_id         UUID REFERENCES transactions(id),
  disbursement_transaction_id UUID REFERENCES transactions(id),
  requested_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by_admin_id        UUID REFERENCES users(id),
  reviewed_at                 TIMESTAMPTZ,
  rejection_reason            TEXT
);
CREATE INDEX IF NOT EXISTS withdrawals_pending_idx
  ON withdrawal_requests(requested_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON withdrawal_requests(user_id);

-- ----- ACH transfers detail -----
CREATE TABLE IF NOT EXISTS ach_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  counterparty_id     UUID NOT NULL REFERENCES counterparties(id),
  sec_code            TEXT NOT NULL CHECK (sec_code IN ('PPD','CCD','WEB')),
  direction           TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  effective_date      DATE NOT NULL,
  trace_number        TEXT,
  return_code         TEXT,
  settlement_status   TEXT NOT NULL DEFAULT 'initiated'
                        CHECK (settlement_status IN
                          ('initiated','submitted','settled','returned','failed')),
  submitted_at        TIMESTAMPTZ,
  settled_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ach_status_idx ON ach_transfers(settlement_status);

-- ----- wire transfers detail -----
CREATE TABLE IF NOT EXISTS wire_transfers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id           UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  beneficiary_name         TEXT NOT NULL,
  beneficiary_address      TEXT,
  beneficiary_bank         TEXT NOT NULL,
  beneficiary_routing      CHAR(9) NOT NULL,
  beneficiary_account_enc  TEXT NOT NULL,
  reference                TEXT,
  omad                     TEXT,
  imad                     TEXT,
  fed_reference            TEXT,
  status                   TEXT NOT NULL DEFAULT 'initiated'
                             CHECK (status IN
                               ('initiated','sent','acknowledged','settled','failed','cancelled')),
  sent_at                  TIMESTAMPTZ,
  settled_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wire_status_idx ON wire_transfers(status);

-- ----- outbox (transactional event publishing) -----
CREATE TABLE IF NOT EXISTS outbox (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic        TEXT NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  attempts     INT NOT NULL DEFAULT 0,
  last_error   TEXT
);
CREATE INDEX IF NOT EXISTS outbox_undelivered_idx
  ON outbox(created_at) WHERE delivered_at IS NULL;
