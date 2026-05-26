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
 * 1. Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_BOOTSTRAP_ENABLED=true in Railway
 * 2. Deploy once to create the admin user
 * 3. Set ADMIN_BOOTSTRAP_ENABLED=false (or remove) after first deploy
 * 4. Admin logs in with credentials — auth is against DB, not env
 */

import { withTransaction } from '@pine/lib-db';
import { hashPassword } from '@pine/lib-crypto';

// Advisory lock ID for admin bootstrap (unique to this operation)
const ADMIN_BOOTSTRAP_LOCK_ID = 8675309;
const ADMIN_BOOTSTRAP_LOCK_KEY = 100;

// Minimum password requirements
const MIN_PASSWORD_LENGTH = 16;

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
 * Validate password strength.
 * Requirements: ≥16 chars, at least one uppercase, one lowercase, one digit.
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < MIN_PASSWORD_LENGTH) return false;
  // At least one uppercase, one lowercase, one digit
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasUpper && hasLower && hasDigit;
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

  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  // Validate email format
  if (!isValidEmail(email)) {
    const error = new Error(
      'admin bootstrap failed: ADMIN_EMAIL is missing or invalid format. ' +
        'Must be a valid email address.',
    );
    logger.error({ code: 'BOOTSTRAP_INVALID_EMAIL' }, error.message);
    throw error;
  }

  // Validate password strength
  if (!isValidPassword(password)) {
    // Clear password from any error context
    password = zeroPassword(password);
    const error = new Error(
      'admin bootstrap failed: ADMIN_PASSWORD is missing or too weak. ' +
        `Must be ≥${MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, and digit.`,
    );
    logger.error({ code: 'BOOTSTRAP_WEAK_PASSWORD' }, error.message);
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
           email, password_hash, full_name, kyc_status,
           mfa_enabled, must_change_password
         )
         VALUES ($1, $2, 'System Administrator', 'approved', FALSE, TRUE)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email, passwordHash],
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
  }
}

export default bootstrapAdmin;
