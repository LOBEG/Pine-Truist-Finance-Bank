/**
 * Reusable database migration runner.
 *
 * This module centralises the migration logic so it can be invoked from both
 * the CLI (`node db/cli.js migrate`) and from a service at startup
 * (see RUN_MIGRATIONS_ON_STARTUP). Applying migrations is serialised across
 * replicas with a Postgres session-level advisory lock, so multiple instances
 * starting at once cannot race each other.
 *
 * Reads the connection from the shared lib-db pool, which must be initialised
 * (via createPool) before calling these functions.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, query, withTransaction } from '@pine/lib-db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Stable, arbitrary 64-bit key. Every replica uses the same key so that only
// one process holds the migration lock at a time; the others wait, then find
// the migrations already applied and continue.
const MIGRATION_ADVISORY_LOCK_KEY = 4815162342n;

// Tables that must exist for the core-banking API to serve requests. Used by
// the fail-fast readiness check so a missing-migration deploy surfaces a clear
// startup error instead of opaque HTTP 500s.
export const CORE_TABLES = Object.freeze(['users', 'accounts', 'roles', 'schema_migrations']);

export async function listMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files.filter((f) => f.endsWith('.sql')).sort();
}

async function ensureMigrationsTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
}

export async function appliedVersions() {
  await ensureMigrationsTable();
  const { rows } = await query('SELECT version FROM schema_migrations');
  return new Set(rows.map((r) => r.version));
}

export async function pendingMigrations() {
  const applied = await appliedVersions();
  const files = await listMigrationFiles();
  return files.filter((f) => !applied.has(f));
}

export async function migrationStatus() {
  const applied = await appliedVersions();
  const files = await listMigrationFiles();
  return files.map((version) => ({ version, applied: applied.has(version) }));
}

/**
 * Apply all pending migrations inside an advisory lock so concurrent replicas
 * do not race. Each migration file runs in its own transaction and is recorded
 * in schema_migrations. Idempotent: already-applied files are skipped.
 *
 * @param {object} [options]
 * @param {object} [options.logger] - Optional logger with an `info` method.
 * @returns {Promise<{applied: number, files: string[]}>}
 */
export async function runMigrations({ logger } = {}) {
  const info = (msg) =>
    logger && typeof logger.info === 'function' ? logger.info(msg) : undefined;
  const pool = getPool();
  const lockClient = await pool.connect();
  const appliedFiles = [];
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);

    const applied = await appliedVersions();
    const files = await listMigrationFiles();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      info(`applying migration ${file}`);
      await withTransaction(async (client) => {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      });
      appliedFiles.push(file);
    }
  } finally {
    await lockClient
      .query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
      .catch(() => {});
    lockClient.release();
  }
  return { applied: appliedFiles.length, files: appliedFiles };
}

/**
 * Verify the database schema is ready to serve requests. Throws a descriptive
 * error if any core table is missing or any migration is still pending. Use at
 * startup to fail fast instead of returning opaque 500s on the first request.
 *
 * @returns {Promise<true>}
 */
export async function assertSchemaReady() {
  const { rows } = await query(
    `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [CORE_TABLES],
  );
  const present = new Set(rows.map((r) => r.table_name));
  const missing = CORE_TABLES.filter((t) => !present.has(t));

  // Only inspect pending migrations if the bookkeeping table itself exists.
  const pending = missing.includes('schema_migrations') ? [] : await pendingMigrations();

  if (missing.length > 0 || pending.length > 0) {
    const detail = [];
    if (missing.length > 0) detail.push(`missing tables: ${missing.join(', ')}`);
    if (pending.length > 0) detail.push(`pending migrations: ${pending.join(', ')}`);
    throw new Error(
      `Database schema is not ready (${detail.join('; ')}). ` +
        'Run "npm run migrate" against DATABASE_URL, or set RUN_MIGRATIONS_ON_STARTUP=true ' +
        'to apply migrations automatically at startup.',
    );
  }
  return true;
}
