import pg from 'pg';

// Always parse numeric columns as strings; we never want floating-point money.
// Caller code uses bigint/decimal helpers from lib-ledger for math.
pg.types.setTypeParser(1700, (val) => val); // numeric
pg.types.setTypeParser(20, (val) => val); // bigint

const { Pool } = pg;

let pool;

export function createPool({ url, ssl = 'require', poolMin = 2, poolMax = 20 } = {}) {
  if (pool) return pool;
  if (!url) throw new Error('[lib-db] DATABASE_URL not configured.');

  let sslConfig;
  if (ssl === 'require') sslConfig = { rejectUnauthorized: true };
  else if (ssl === 'no-verify') sslConfig = { rejectUnauthorized: false };
  else sslConfig = false;

  pool = new Pool({
    connectionString: url,
    ssl: sslConfig,
    min: poolMin,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: process.env.SERVICE_NAME || 'pine-bank',
  });

  pool.on('error', (err) => {
    console.error('[lib-db] Idle client error', err);
  });

  return pool;
}

export function getPool() {
  if (!pool) throw new Error('[lib-db] Pool not initialized. Call createPool first.');
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

/**
 * Run a function inside a serializable transaction.
 * Retries automatically on serialization conflicts (40001/40P01).
 */
export async function withTransaction(fn, { isolation = 'READ COMMITTED', maxRetries = 3 } = {}) {
  const p = getPool();
  let attempt = 0;

  while (true) {
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const code = err && err.code;
      if ((code === '40001' || code === '40P01') && attempt < maxRetries) {
        attempt += 1;
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
}

export async function shutdown() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
