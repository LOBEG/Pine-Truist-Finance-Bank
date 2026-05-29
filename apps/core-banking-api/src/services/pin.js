import { query, withTransaction } from '@pine/lib-db';
import { verifyPin } from '@pine/lib-crypto';
import { errors } from '@pine/lib-http';

/**
 * Atomically consume an active PIN for a user and purpose.
 * - Locks the row FOR UPDATE.
 * - Increments attempts on every check.
 * - Expires past max_attempts or expires_at.
 * - On success: marks consumed, returns pin id.
 *
 * @returns {Promise<{ pinId: string }>} On success.
 * @throws AppError on any failure mode.
 */
export async function consumePin({ userId, purpose, plaintextPin }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, pin_hash, attempts, max_attempts, expires_at, status, purpose
         FROM transfer_pins
        WHERE user_id = $1 AND status = 'active'
          AND purpose IN ($2, 'generic')
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [userId, purpose],
    );
    const pin = rows[0];
    if (!pin) throw errors.forbidden('no_active_pin', 'No active PIN. Contact support.');

    if (new Date(pin.expires_at) <= new Date()) {
      await client.query(`UPDATE transfer_pins SET status = 'expired' WHERE id = $1`, [pin.id]);
      throw errors.forbidden('pin_expired', 'PIN expired.');
    }

    const ok = await verifyPin(pin.pin_hash, plaintextPin);
    const attempts = pin.attempts + 1;
    if (!ok) {
      const exhausted = attempts >= pin.max_attempts;
      await client.query(
        `UPDATE transfer_pins
            SET attempts = $2,
                status = CASE WHEN $3 THEN 'revoked' ELSE status END
          WHERE id = $1`,
        [pin.id, attempts, exhausted],
      );
      if (exhausted) throw errors.forbidden('pin_locked', 'PIN locked. Request a new one.');
      throw errors.forbidden('invalid_pin', 'Invalid PIN.');
    }

    await client.query(
      `UPDATE transfer_pins
          SET status = 'consumed', consumed_at = now(), attempts = $2
        WHERE id = $1`,
      [pin.id, attempts],
    );
    return { pinId: pin.id };
  });
}

export async function listActivePinMetadata(userId) {
  const { rows } = await query(
    `SELECT id, purpose, transaction_id, expires_at, attempts, max_attempts, created_at
       FROM transfer_pins
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}
