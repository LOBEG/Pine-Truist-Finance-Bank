#!/usr/bin/env node
/**
 * Database CLI: migrate / status / seed
 *
 *   node db/cli.js migrate    -> apply all pending SQL migrations
 *   node db/cli.js status     -> show applied / pending list
 *   node db/cli.js seed       -> run historical seed (idempotent guard)
 *
 * Reads DATABASE_URL / DATABASE_SSL from env. The migration logic lives in
 * db/migrate.js so it can be shared with services that auto-migrate at startup.
 */
import { createPool, shutdown } from '@pine/lib-db';
import { runMigrations, migrationStatus } from './migrate.js';
import { seedHistorical } from './seeds/historical.js';

async function status() {
  const entries = await migrationStatus();
  for (const { version, applied } of entries) {
    console.info(`${applied ? '[x]' : '[ ]'} ${version}`);
  }
}

async function main() {
  const cmd = process.argv[2] || 'migrate';
  createPool({
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL || 'require',
  });
  try {
    if (cmd === 'migrate') {
      const { applied, files } = await runMigrations({ logger: console });
      if (applied === 0) console.info('No pending migrations.');
      else console.info(`Migrations complete (${applied} applied: ${files.join(', ')}).`);
    } else if (cmd === 'status') await status();
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
