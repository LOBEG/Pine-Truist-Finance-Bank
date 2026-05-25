#!/usr/bin/env node
/**
 * Database CLI: migrate / status / seed
 *
 *   node db/cli.js migrate    -> apply all pending SQL migrations
 *   node db/cli.js status     -> show applied / pending list
 *   node db/cli.js seed       -> run historical seed (idempotent guard)
 *
 * Reads DATABASE_URL / DATABASE_SSL from env.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, query, shutdown, withTransaction } from '@pine/lib-db';
import { seedHistorical } from './seeds/historical.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function listMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files.filter((f) => f.endsWith('.sql')).sort();
}

async function appliedSet() {
  await query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await query('SELECT version FROM schema_migrations');
  return new Set(rows.map((r) => r.version));
}

async function runMigrations() {
  const applied = await appliedSet();
  const files = await listMigrationFiles();
  for (const file of files) {
    if (applied.has(file)) {
      console.info(`= ${file} (already applied)`);
      continue;
    }
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.info(`> ${file}`);
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [file]);
    });
  }
  console.info('Migrations complete.');
}

async function status() {
  const applied = await appliedSet();
  const files = await listMigrationFiles();
  for (const f of files) console.info(`${applied.has(f) ? '[x]' : '[ ]'} ${f}`);
}

async function main() {
  const cmd = process.argv[2] || 'migrate';
  createPool({
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL || 'require',
  });
  try {
    if (cmd === 'migrate') await runMigrations();
    else if (cmd === 'status') await status();
    else if (cmd === 'seed') await seedHistorical();
    else throw new Error(`Unknown command: ${cmd}`);
  } finally {
    await shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
