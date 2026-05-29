import { sha256Hex, generateOpaqueToken } from '@pine/lib-crypto';
import { query, withTransaction } from '@pine/lib-db';
import crypto from 'node:crypto';

const REFRESH_BYTES = 48;

export class SessionService {
  constructor({ refreshTokenPepper, refreshTtlSeconds }) {
    if (!refreshTokenPepper) throw new Error('REFRESH_TOKEN_PEPPER not configured');
    this.pepper = refreshTokenPepper;
    this.refreshTtlSeconds = refreshTtlSeconds;
  }

  async create({ userId, deviceFingerprint, ip, userAgent, familyId, client }) {
    const refreshToken = generateOpaqueToken(REFRESH_BYTES);
    const hash = sha256Hex(refreshToken, this.pepper);
    const family = familyId || crypto.randomUUID();
    const expires = new Date(Date.now() + this.refreshTtlSeconds * 1000);
    const exec = client ? (q, p) => client.query(q, p) : (q, p) => query(q, p);
    const { rows } = await exec(
      `INSERT INTO sessions
         (user_id, refresh_token_hash, family_id, device_fingerprint, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5::inet, $6, $7)
       RETURNING id`,
      [userId, hash, family, deviceFingerprint || null, ip || null, userAgent || null, expires],
    );
    return { sessionId: rows[0].id, refreshToken, familyId: family };
  }

  // Refresh rotation must be atomic to survive concurrent refresh calls and
  // refresh-token reuse attacks. The current session is locked FOR UPDATE,
  // marked revoked, and the new session is inserted — all within a single
  // serializable transaction. If two clients race with the same refresh
  // token, exactly one wins; the other observes `revoked_at` and triggers
  // the family-wide revocation reuse-detection path.
  async rotate({ refreshToken, ip, userAgent }) {
    const hash = sha256Hex(refreshToken, this.pepper);
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, user_id, family_id, revoked_at, expires_at
           FROM sessions WHERE refresh_token_hash = $1
           FOR UPDATE`,
        [hash],
      );
      const session = rows[0];
      if (!session) throw new Error('invalid_refresh');
      if (session.revoked_at) {
        await client.query(
          `UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()),
                                revoked_reason = 'reuse_detected'
           WHERE family_id = $1`,
          [session.family_id],
        );
        throw new Error('refresh_reused');
      }
      if (new Date(session.expires_at) <= new Date()) throw new Error('expired_refresh');
      await client.query(
        `UPDATE sessions SET revoked_at = now(), revoked_reason = 'rotated' WHERE id = $1`,
        [session.id],
      );
      const next = await this.create({
        userId: session.user_id,
        familyId: session.family_id,
        ip,
        userAgent,
        client,
      });
      return { ...next, userId: session.user_id };
    });
  }

  async revoke({ refreshToken, reason = 'logout' }) {
    const hash = sha256Hex(refreshToken, this.pepper);
    await query(
      `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [hash, reason],
    );
  }
}
