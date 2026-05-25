import { query } from '@pine/lib-db';
import { encryptField, generateAccountNumber, hashPassword } from '@pine/lib-crypto';

const ROUTING = '053000219';
let _cache;

/**
 * Returns the id of a system-owned "external clearing" checking account used
 * as the counter-leg for deposits and withdrawals that move money in/out of
 * the bank as a whole. Created lazily and idempotently.
 */
export async function getExternalClearingAccount(kekB64) {
  if (_cache) return _cache;

  const sysUserRow = await query(`SELECT id FROM users WHERE email = 'system@pinebank.internal'`);
  let sysUserId = sysUserRow.rows[0]?.id;
  if (!sysUserId) {
    const r = await query(
      `INSERT INTO users (email, password_hash, full_name, kyc_status)
       VALUES ('system@pinebank.internal', $1, 'Pine Bank System', 'approved')
       ON CONFLICT (email) DO UPDATE SET kyc_status = EXCLUDED.kyc_status
       RETURNING id`,
      [await hashPassword('!!system-account-no-login-' + Date.now() + '!!')],
    );
    sysUserId = r.rows[0].id;
  }

  const acc = await query(
    `SELECT id FROM accounts
      WHERE user_id = $1 AND account_type = 'checking' AND nickname = 'EXTERNAL_CLEARING'`,
    [sysUserId],
  );
  if (acc.rows[0]) {
    _cache = acc.rows[0].id;
    return _cache;
  }
  const num = generateAccountNumber();
  const ins = await query(
    `INSERT INTO accounts
       (user_id, account_number_encrypted, account_number_last4, routing_number,
        account_type, nickname, status)
     VALUES ($1, $2, $3, $4, 'checking', 'EXTERNAL_CLEARING', 'active')
     RETURNING id`,
    [sysUserId, encryptField(num, kekB64), num.slice(-4), ROUTING],
  );
  _cache = ins.rows[0].id;
  return _cache;
}
