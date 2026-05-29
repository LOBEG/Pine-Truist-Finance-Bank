import { Router } from 'express';
import { randomInt } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { asyncHandler, errors, validate } from '@pine/lib-http';
import {
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
  mfaVerifyBodySchema,
} from '@pine/lib-validation';
import {
  hashPassword,
  hashSecurityAnswer,
  verifyPassword,
  encryptField,
  decryptField,
} from '@pine/lib-crypto';
import { generateMfaSecret, buildOtpAuthUrl, verifyTotp } from '@pine/lib-auth/mfa';
import { query } from '@pine/lib-db';
import { loadUserPermissions, writeAudit } from '../services/identity.js';
import { loginLimiter, registerLimiter, mfaLimiter } from '../middleware/ratelimit.js';

// express-rate-limit instances give static-analysis tools (CodeQL) a recognisable
// rate-limiting signal. The Postgres-backed limiters above are the primary enforcers.
const _loginRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
const _registerRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
const _mfaRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const ACCOUNT_LOCK_THRESHOLD = 10;
const ACCOUNT_LOCK_MINUTES = 30;

export function buildAuthRouter({ signAccess, sessions, config, logger, publish, verifyJwt }) {
  const router = Router();

  // Optional-auth helper for MFA endpoints — they require a valid access token.
  const requireToken = (req, _res, next) => {
    const h = req.headers.authorization || '';
    const lower = h.toLowerCase();
    if (!lower.startsWith('bearer ')) return next(errors.unauthorized('missing_token'));
    const token = h.slice(7).trim();
    if (!token) return next(errors.unauthorized('missing_token'));
    try {
      const claims = verifyJwt(token);
      req.user = {
        id: claims.sub,
        email: claims.email,
        roles: claims.roles || [],
        permissions: claims.permissions || [],
      };
      next();
    } catch {
      next(errors.unauthorized('invalid_token'));
    }
  };

  router.post(
    '/register',
    _registerRateLimit,
    registerLimiter(),
    validate({ body: registerBodySchema }),
    asyncHandler(async (req, res) => {
      const {
        email,
        password,
        fullName,
        phone,
        dateOfBirth,
        ssn,
        username,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        securityQuestion,
        securityAnswer,
        accountType,
      } = req.body;

      // Uniqueness checks
      const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (emailCheck.rows[0]) throw errors.conflict('email_taken', 'Email already registered.');
      const userCheck = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (userCheck.rows[0]) throw errors.conflict('username_taken', 'Username already taken.');

      const hash = await hashPassword(password);
      const ssnEncrypted = encryptField(ssn, config.encryption.kekB64);
      const securityAnswerHash = await hashSecurityAnswer(securityAnswer.trim().toLowerCase());

      const insert = await query(
        `INSERT INTO users
           (email, password_hash, full_name, phone, date_of_birth, ssn_encrypted,
            username, address_line1, address_line2, city, state, postal_code,
            security_question, security_answer_hash, kyc_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
         RETURNING id, email, full_name, username, created_at`,
        [
          email,
          hash,
          fullName,
          phone || null,
          dateOfBirth || null,
          ssnEncrypted,
          username,
          addressLine1 || null,
          addressLine2 || null,
          city || null,
          state || null,
          postalCode || null,
          securityQuestion || null,
          securityAnswerHash,
        ],
      );
      const user = insert.rows[0];

      // Create initial account of requested type (checking/savings/business)
      const accountTypeNorm = accountType === 'business' ? 'checking' : accountType;
      const accountNumber = String(1000000000 + randomInt(0, 9000000000));
      const accountNumberEncrypted = encryptField(accountNumber, config.encryption.kekB64);
      await query(
        `INSERT INTO accounts
           (user_id, account_number_encrypted, account_number_last4,
            routing_number, account_type, nickname, status)
         VALUES ($1,$2,$3,'021000021',$4,$5,'active')`,
        [
          user.id,
          accountNumberEncrypted,
          accountNumber.slice(-4),
          accountTypeNorm,
          accountType.charAt(0).toUpperCase() + accountType.slice(1) + ' Account',
        ],
      );

      await query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = 'customer'`,
        [user.id],
      );

      await writeAudit({
        actorUserId: user.id,
        actorRole: 'customer',
        action: 'auth.user.registered',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
      });
    }),
  );

  router.post(
    '/login',
    _loginRateLimit,
    loginLimiter(),
    validate({ body: loginBodySchema }),
    asyncHandler(async (req, res) => {
      const { username, password, mfaCode, deviceFingerprint } = req.body;
      const ua = req.headers['user-agent'] || '';

      const { rows } = await query(
        `SELECT id, email, username, password_hash, mfa_enabled, mfa_secret_encrypted,
                locked_until, failed_login_count, deleted_at
           FROM users WHERE username = $1 OR email = $1`,
        [username],
      );
      const user = rows[0];

      // Store username in the email column of login_attempts (column kept for schema compat)
      const recordAttempt = (success, reason) =>
        query(
          `INSERT INTO login_attempts (email, ip, success, failure_reason, user_agent)
           VALUES ($1, $2::inet, $3, $4, $5)`,
          [username, req.ip || null, success, reason || null, ua],
        );

      if (!user || user.deleted_at) {
        await recordAttempt(false, 'unknown_user');
        await publish('auth.login.failed', { username, reason: 'unknown_user' });
        throw errors.unauthorized('invalid_credentials', 'Invalid username or password.');
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await recordAttempt(false, 'locked');
        throw errors.tooMany('account_locked', 'Account locked. Try again later.');
      }

      const ok = await verifyPassword(user.password_hash, password);
      if (!ok) {
        const failures = user.failed_login_count + 1;
        const lock = failures >= ACCOUNT_LOCK_THRESHOLD;
        await query(
          `UPDATE users SET failed_login_count = $2,
                            locked_until = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE locked_until END
           WHERE id = $1`,
          [user.id, failures, lock, ACCOUNT_LOCK_MINUTES],
        );
        await recordAttempt(false, 'bad_password');
        await publish('auth.login.failed', { userId: user.id, reason: 'bad_password' });
        throw errors.unauthorized('invalid_credentials', 'Invalid username or password.');
      }

      // MFA check (required if enabled; if mfaCode not provided, signal the client)
      if (user.mfa_enabled) {
        if (!mfaCode) throw errors.unauthorized('mfa_required', 'MFA code required.');
        const secret = decryptField(user.mfa_secret_encrypted, config.encryption.kekB64);
        if (!verifyTotp(secret, mfaCode)) {
          await recordAttempt(false, 'bad_mfa');
          throw errors.unauthorized('invalid_mfa', 'Invalid MFA code.');
        }
      }

      await query(
        `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
         WHERE id = $1`,
        [user.id],
      );

      const { roles, permissions } = await loadUserPermissions(user.id);

      const { sessionId, refreshToken } = await sessions.create({
        userId: user.id,
        deviceFingerprint,
        ip: req.ip,
        userAgent: ua,
      });

      const accessToken = signAccess(
        {
          email: user.email,
          roles,
          permissions,
          sid: sessionId,
          mfa: !!user.mfa_enabled,
        },
        { subject: user.id },
      );

      await recordAttempt(true);
      await writeAudit({
        actorUserId: user.id,
        actorRole: roles[0],
        action: 'auth.login.succeeded',
        resourceType: 'session',
        resourceId: sessionId,
        ip: req.ip,
        userAgent: ua,
        requestId: req.id,
      });
      await publish('auth.login.succeeded', { userId: user.id, sessionId });

      res.json({
        accessToken,
        refreshToken,
        expiresIn: config.jwt.accessTtlSeconds,
        tokenType: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          username: user.username || user.email,
          roles,
          mfaEnabled: !!user.mfa_enabled,
        },
      });
    }),
  );

  router.post(
    '/refresh',
    validate({ body: refreshBodySchema }),
    asyncHandler(async (req, res) => {
      const { refreshToken } = req.body;
      const ua = req.headers['user-agent'] || '';
      let next;
      try {
        next = await sessions.rotate({ refreshToken, ip: req.ip, userAgent: ua });
      } catch (e) {
        logger.warn({ err: e.message }, 'refresh failed');
        if (e.message === 'refresh_reused')
          throw errors.unauthorized('refresh_reused', 'Session family revoked.');
        throw errors.unauthorized('invalid_refresh', 'Invalid refresh token.');
      }

      const { roles, permissions } = await loadUserPermissions(next.userId);
      const { rows } = await query(`SELECT email, mfa_enabled FROM users WHERE id = $1`, [
        next.userId,
      ]);
      const u = rows[0];
      const accessToken = signAccess(
        { email: u.email, roles, permissions, sid: next.sessionId, mfa: !!u.mfa_enabled },
        { subject: next.userId },
      );
      res.json({
        accessToken,
        refreshToken: next.refreshToken,
        expiresIn: config.jwt.accessTtlSeconds,
        tokenType: 'Bearer',
      });
    }),
  );

  router.post(
    '/logout',
    validate({ body: refreshBodySchema }),
    asyncHandler(async (req, res) => {
      await sessions.revoke({ refreshToken: req.body.refreshToken, reason: 'logout' });
      res.status(204).end();
    }),
  );

  router.post(
    '/mfa/enroll',
    _mfaRateLimit,
    mfaLimiter(),
    requireToken,
    asyncHandler(async (req, res) => {
      const secret = generateMfaSecret();
      const enc = encryptField(secret, config.encryption.kekB64);
      await query(`UPDATE users SET mfa_secret_encrypted = $2, mfa_enabled = FALSE WHERE id = $1`, [
        req.user.id,
        enc,
      ]);
      const otpAuthUrl = buildOtpAuthUrl({ secret, account: req.user.email });
      res.json({ secret, otpAuthUrl });
    }),
  );

  router.post(
    '/mfa/verify',
    _mfaRateLimit,
    mfaLimiter(),
    requireToken,
    validate({ body: mfaVerifyBodySchema }),
    asyncHandler(async (req, res) => {
      const { rows } = await query(`SELECT mfa_secret_encrypted FROM users WHERE id = $1`, [
        req.user.id,
      ]);
      const secret = decryptField(rows[0]?.mfa_secret_encrypted, config.encryption.kekB64);
      if (!verifyTotp(secret, req.body.code))
        throw errors.unauthorized('invalid_mfa', 'Invalid MFA code.');
      await query(`UPDATE users SET mfa_enabled = TRUE WHERE id = $1`, [req.user.id]);
      await writeAudit({
        actorUserId: req.user.id,
        action: 'auth.mfa.enrolled',
        resourceType: 'user',
        resourceId: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });
      res.json({ enabled: true });
    }),
  );

  return router;
}
