import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { listMigrationFiles, CORE_TABLES } from '../../db/migrate.js';

/**
 * Migration runner unit tests.
 *
 * These cover the filesystem-level behaviour that does not require a live
 * database connection: discovery and ordering of migration files, and the
 * set of core tables used by the startup readiness check.
 */
describe('db/migrate', () => {
  test('listMigrationFiles returns only .sql files, sorted ascending', async () => {
    const files = await listMigrationFiles();
    assert.ok(files.length > 0, 'expected at least one migration file');
    assert.ok(
      files.every((f) => f.endsWith('.sql')),
      'all entries must be .sql files',
    );
    const sorted = [...files].sort();
    assert.deepEqual(files, sorted, 'files must be returned in sorted order');
  });

  test('migration files are numerically prefixed and start at 0001', async () => {
    const files = await listMigrationFiles();
    assert.match(files[0], /^0001_/, 'first migration should be 0001_*');
    for (const f of files) {
      assert.match(f, /^\d{4}_.+\.sql$/, `unexpected migration filename: ${f}`);
    }
  });

  test('CORE_TABLES includes the schema bookkeeping and primary auth tables', () => {
    for (const t of ['users', 'accounts', 'roles', 'schema_migrations']) {
      assert.ok(CORE_TABLES.includes(t), `CORE_TABLES should include ${t}`);
    }
  });
});
