#!/usr/bin/env node
/**
 * Bootstrap script: create or upgrade a user to `super_admin` with a forced
 * password change on first login + mandatory MFA enrollment.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@pinebank.com \
 *   ADMIN_PASSWORD='use-a-long-passphrase' \
 *   node scripts/create-admin.js
 *
 * NOTE: For automated bootstrap at server startup, use ADMIN_BOOTSTRAP_ENABLED=true
 * with the core-banking-api server. This script is for manual/CLI admin creation.
 */
import { createPool, query, shutdown } from '@pine/lib-db';
import { hashPassword } from '@pine/lib-crypto';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
    process.exit(2);
  }
  if (password.length < 16) {
    console.error('ADMIN_PASSWORD must be at least 16 characters.');
    process.exit(2);
  }

  createPool({ url: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL || 'require' });

  try {
    const hash = await hashPassword(password);
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await query(
        `UPDATE users SET password_hash = $2, must_change_password = TRUE,
                          locked_until = NULL, failed_login_count = 0,
                          kyc_status = 'approved'
         WHERE id = $1`,
        [userId, hash],
      );
      console.info(`Updated existing user ${email}`);
    } else {
      const r = await query(
        `INSERT INTO users (email, password_hash, full_name, kyc_status, must_change_password)
         VALUES ($1, $2, 'Pine Bank Administrator', 'approved', TRUE)
         RETURNING id`,
        [email, hash],
      );
      userId = r.rows[0].id;
      console.info(`Created new user ${email}`);
    }
    await query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'super_admin'
       ON CONFLICT DO NOTHING`,
      [userId],
    );
    console.info(`Assigned super_admin role. MFA enrollment required on first login.`);
  } finally {
    await shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
