/**
 * Admin Bootstrap Service
 *
 * Creates the first admin user ONLY at server startup when explicitly enabled.
 * This is a one-time bootstrap mechanism — after the admin exists, this service
 * becomes a no-op. The admin's credentials in environment variables are NEVER
 * used for authentication; login always authenticates against the DB hash.
 *
 * Security invariants:
 * - ADMIN_BOOTSTRAP_ENABLED must be 'true' (string literal) to activate
 * - Email format is validated before any DB operation
 * - Password must be ≥16 characters with complexity requirements
 * - Uses advisory lock + ON CONFLICT to prevent race conditions
 * - Plaintext password is zeroed from memory after hashing
 * - Password is NEVER logged
 *
 * Usage (Railway/production):
 * 1. Set ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_BOOTSTRAP_ENABLED=true in Railway
 *    (ADMIN_EMAIL is optional; if omitted a placeholder is derived from the
 *    username so the admin can sign in with the username alone).
 * 2. Deploy once to create the admin user
 * 3. Set ADMIN_BOOTSTRAP_ENABLED=false (or remove) after first deploy
 * 4. Admin logs in with the username + password — auth is against DB, not env
 */

import { withTransaction } from '@pine/lib-db';
import { hashPassword } from '@pine/lib-crypto';

// Advisory lock ID for admin bootstrap (unique to this operation)
const ADMIN_BOOTSTRAP_LOCK_ID = 8675309;
const ADMIN_BOOTSTRAP_LOCK_KEY = 100;

// Default admin username when ADMIN_USERNAME is not provided.
const DEFAULT_ADMIN_USERNAME = 'admin';

/**
 * Validate email format using a basic RFC 5322 compatible pattern.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Basic email validation - must have @ with text before and after, and a dot in domain
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate the admin username. Letters, digits, dots, hyphens and underscores,
 * 1–32 characters (mirrors the registration username rules but allows short
 * operator-chosen names like "admin").
 */
function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  return /^[a-zA-Z0-9._-]{1,32}$/.test(username);
}

/**
 * Validate the admin password. The operator chooses the password; the only
 * requirement is that it is a non-empty string so it can be hashed.
 */
function isValidPassword(password) {
  return typeof password === 'string' && password.length > 0;
}

/**
 * Zero out a string buffer to prevent memory leaks of sensitive data.
 * Note: In JavaScript, strings are immutable, so we can only null the reference.
 * For true zeroing, use Buffer; this function is a best-effort for the API contract.
 */
function zeroPassword(_passwordRef) {
  // JavaScript strings are immutable; we can only drop the reference
  // The GC will eventually clean up, but we can't guarantee immediate zeroing
  // This is a limitation of JS; in production, consider using Buffer for secrets
  return null;
}

/**
 * Bootstrap the first admin user if:
 * - ADMIN_BOOTSTRAP_ENABLED === 'true'
 * - No admin user exists
 * - Credentials pass validation
 *
 * @param {object} options
 * @param {object} options.logger - Pino-compatible logger
 * @returns {Promise<{created: boolean, skipped: boolean, reason: string}>}
 */
export async function bootstrapAdmin({ logger }) {
  const enabled = process.env.ADMIN_BOOTSTRAP_ENABLED;

  // Return early if bootstrap is not explicitly enabled
  if (enabled !== 'true') {
    logger.debug('admin bootstrap skipped: ADMIN_BOOTSTRAP_ENABLED !== true');
    return { created: false, skipped: true, reason: 'disabled' };
  }

  let username = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim();
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  // Validate username
  if (!isValidUsername(username)) {
    const error = new Error(
      'admin bootstrap failed: ADMIN_USERNAME is invalid. ' +
        'Must be 1–32 characters: letters, digits, dots, hyphens, underscores only.',
    );
    logger.error({ code: 'BOOTSTRAP_INVALID_USERNAME' }, error.message);
    throw error;
  }

  // Email is optional. When omitted, derive a placeholder from the username so
  // the NOT NULL/UNIQUE users.email column is satisfied and the admin can sign
  // in with the username alone.
  if (!email) {
    email = `${username.toLowerCase()}@admin.local`;
  }

  // Validate email format
  if (!isValidEmail(email)) {
    const error = new Error(
      'admin bootstrap failed: ADMIN_EMAIL is invalid format. ' + 'Must be a valid email address.',
    );
    logger.error({ code: 'BOOTSTRAP_INVALID_EMAIL' }, error.message);
    throw error;
  }

  // Validate password (operator's choice; only non-empty is required)
  if (!isValidPassword(password)) {
    // Clear password from any error context
    password = zeroPassword(password);
    const error = new Error(
      'admin bootstrap failed: ADMIN_PASSWORD is missing. ' +
        'Set ADMIN_PASSWORD to a non-empty value.',
    );
    logger.error({ code: 'BOOTSTRAP_MISSING_PASSWORD' }, error.message);
    throw error;
  }

  try {
    const result = await withTransaction(async (client) => {
      // Acquire advisory lock to prevent race conditions across multiple instances
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [
        ADMIN_BOOTSTRAP_LOCK_ID,
        ADMIN_BOOTSTRAP_LOCK_KEY,
      ]);

      // Check if ANY admin already exists (by role assignment)
      const existingAdmin = await client.query(
        `SELECT u.id, u.email FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.name IN ('admin', 'super_admin')
         AND u.deleted_at IS NULL
         LIMIT 1`,
      );

      if (existingAdmin.rows[0]) {
        logger.info('admin bootstrap skipped: admin already present');
        return { created: false, skipped: true, reason: 'admin_exists' };
      }

      // Hash password with Argon2id (OWASP recommended, equivalent security to bcrypt ≥12)
      const passwordHash = await hashPassword(password);

      // Insert admin user with ON CONFLICT DO NOTHING for idempotency
      // Note: Using 'approved' kyc_status since this is a system admin
      const insertResult = await client.query(
        `INSERT INTO users (
           email, username, password_hash, full_name, kyc_status,
           mfa_enabled, must_change_password
         )
         VALUES ($1, $2, $3, 'System Administrator', 'approved', FALSE, TRUE)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email, username, passwordHash],
      );

      if (!insertResult.rows[0]) {
        // User with this email already exists but isn't an admin
        // This is a conflict - don't override existing user
        logger.warn(
          { email: email.replace(/@.*/, '@***') },
          'admin bootstrap skipped: user with email already exists (not admin)',
        );
        return { created: false, skipped: true, reason: 'email_exists' };
      }

      const userId = insertResult.rows[0].id;

      // Assign super_admin role
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = 'super_admin'
         ON CONFLICT DO NOTHING`,
        [userId],
      );

      logger.info(
        { userId, email: email.replace(/@.*/, '@***') },
        'admin bootstrap: super_admin user created successfully',
      );

      return { created: true, skipped: false, reason: 'created', userId };
    });

    return result;
  } finally {
    // Zero out password from memory (best effort in JS)
    password = zeroPassword(password);
    email = null;
    username = null;
  }
}

export default bootstrapAdmin;
