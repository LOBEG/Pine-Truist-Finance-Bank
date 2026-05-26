/**
 * @pine/lib-queue — Postgres-native job queue
 *
 * ARCHITECTURE CHANGE (v2.0):
 * This module replaces the Redis-based BullMQ implementation with pg-boss,
 * a Postgres-native job queue. This eliminates the Redis dependency,
 * simplifies infrastructure, and ensures job state survives restarts.
 *
 * For pub/sub events, see lib-events which now uses LISTEN/NOTIFY.
 */
import PgBoss from 'pg-boss';
import { query } from '@pine/lib-db';

let boss = null;

export const QUEUE_NAMES = Object.freeze({
  NOTIFICATIONS: 'notifications',
  TRANSACTIONS: 'transactions',
  FRAUD: 'fraud',
  AUDIT: 'audit',
  ACH_OUTBOUND: 'ach-outbound',
  WIRE_OUTBOUND: 'wire-outbound',
});

const DEFAULT_JOB_OPTIONS = {
  retryLimit: 5,
  retryDelay: 5,
  retryBackoff: true,
  expireInSeconds: 60 * 60 * 24 * 7, // 7 days
};

/**
 * Initialize pg-boss with the existing Postgres connection.
 * Call this once at application startup.
 */
export async function initQueue(databaseUrl) {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: databaseUrl,
    // Use existing pool if possible for connection efficiency
    application_name: 'pine-queue',
    // Maintenance config
    archiveCompletedAfterSeconds: 60 * 60 * 24 * 7, // Archive after 7 days
    deleteAfterSeconds: 60 * 60 * 24 * 30, // Delete after 30 days
    // Monitoring
    monitorStateIntervalSeconds: 30,
  });

  boss.on('error', (err) => {
    console.error('[lib-queue] pg-boss error:', err);
  });

  await boss.start();
  return boss;
}

export function getBoss() {
  if (!boss) throw new Error('[lib-queue] pg-boss not initialized. Call initQueue first.');
  return boss;
}

/**
 * Enqueue a job. Returns job ID.
 */
export async function enqueue(queueName, data, options = {}) {
  const b = getBoss();
  const jobId = await b.send(queueName, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
  return jobId;
}

/**
 * Create a worker that processes jobs from a queue.
 * Handler signature: async (job) => result
 * Job object: { id, name, data }
 */
export async function createWorker(queueName, handler, options = {}) {
  const b = getBoss();
  const { concurrency = 5 } = options;

  await b.work(queueName, { teamSize: concurrency, teamConcurrency: concurrency }, async (job) => {
    // pg-boss handles retry logic automatically
    return await handler(job);
  });

  return {
    close: async () => {
      await b.offWork(queueName);
    },
  };
}

/**
 * Schedule a recurring job (cron-like).
 */
export async function schedule(queueName, cronExpression, data = {}, options = {}) {
  const b = getBoss();
  await b.schedule(queueName, cronExpression, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });
}

/**
 * Get queue statistics.
 */
export async function getQueueSize(queueName) {
  const b = getBoss();
  return b.getQueueSize(queueName);
}

/**
 * Gracefully shutdown the queue.
 */
export async function shutdownQueue() {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 30000 });
    boss = null;
  }
}

// --------------------- Outbox relay ---------------------
// Reads unsent outbox rows and publishes via pg-boss jobs.
// Consumers dedupe on event id.

export async function pollOutboxOnce({ publish, batchSize = 100 }) {
  // Atomically claim a batch of undelivered outbox rows.
  // Using SKIP LOCKED ensures concurrent relays don't double-claim.
  const { rows } = await query(
    `WITH claimed AS (
       SELECT id FROM outbox
        WHERE delivered_at IS NULL
        ORDER BY created_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE outbox o SET delivered_at = now()
       FROM claimed
      WHERE o.id = claimed.id
     RETURNING o.id, o.topic, o.payload`,
    [batchSize],
  );
  for (const row of rows) {
    try {
      await publish(row.topic, { id: row.id, ...row.payload });
    } catch (err) {
      // Roll back the claim and bump attempts so it retries on next tick.
      await query(
        `UPDATE outbox SET delivered_at = NULL,
                            attempts = attempts + 1,
                            last_error = $2
           WHERE id = $1`,
        [row.id, err.message],
      );
    }
  }
  return rows.length;
}

export function startOutboxRelay({ publish, intervalMs = 1_000, logger }) {
  let stopping = false;
  async function loop() {
    while (!stopping) {
      try {
        const n = await pollOutboxOnce({ publish });
        if (n === 0) await new Promise((r) => setTimeout(r, intervalMs));
      } catch (err) {
        logger?.error({ err }, 'outbox relay error');
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
  }
  loop();
  return () => {
    stopping = true;
  };
}

// --------------------- Advisory lock helpers ---------------------

export const ADVISORY_LOCK_IDS = Object.freeze({
  SCHEDULER: [8675309, 1],
  OUTBOX_RELAY: [8675309, 2],
  RECONCILIATION: [8675309, 3],
});

/**
 * Try to acquire an advisory lock. Returns true if acquired.
 * Non-blocking — returns immediately.
 */
export async function tryAdvisoryLock(lockId1, lockId2) {
  const { rows } = await query(`SELECT pg_try_advisory_lock($1, $2) AS acquired`, [
    lockId1,
    lockId2,
  ]);
  return rows[0].acquired;
}

/**
 * Release an advisory lock.
 */
export async function releaseAdvisoryLock(lockId1, lockId2) {
  await query(`SELECT pg_advisory_unlock($1, $2)`, [lockId1, lockId2]);
}

/**
 * Run a function while holding an advisory lock.
 * Throws if lock cannot be acquired.
 */
export async function withAdvisoryLock(lockId1, lockId2, fn) {
  const acquired = await tryAdvisoryLock(lockId1, lockId2);
  if (!acquired) {
    throw new Error(`Failed to acquire advisory lock [${lockId1}, ${lockId2}]`);
  }
  try {
    return await fn();
  } finally {
    await releaseAdvisoryLock(lockId1, lockId2);
  }
}
