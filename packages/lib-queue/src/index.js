import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { query } from '@pine/lib-db';

let connection;

export function getRedisConnection(url) {
  if (connection) return connection;
  if (!url) throw new Error('[lib-queue] REDIS_URL not configured.');
  connection = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: true });
  return connection;
}

export const QUEUE_NAMES = Object.freeze({
  NOTIFICATIONS: 'notifications',
  TRANSACTIONS: 'transactions',
  FRAUD: 'fraud',
  AUDIT: 'audit',
  ACH_OUTBOUND: 'ach-outbound',
  WIRE_OUTBOUND: 'wire-outbound',
});

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 5_000, age: 60 * 60 * 24 * 7 },
  removeOnFail: { count: 10_000, age: 60 * 60 * 24 * 30 },
};

const queues = new Map();

export function getQueue(name, redisUrl) {
  if (queues.has(name)) return queues.get(name);
  const q = new Queue(name, {
    connection: getRedisConnection(redisUrl),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
  queues.set(name, q);
  return q;
}

export function createWorker(name, processor, { redisUrl, concurrency = 5 } = {}) {
  return new Worker(name, processor, {
    connection: getRedisConnection(redisUrl),
    concurrency,
    autorun: true,
  });
}

export function createQueueEvents(name, redisUrl) {
  return new QueueEvents(name, { connection: getRedisConnection(redisUrl) });
}

// --------------------- Outbox relay ---------------------
// Periodically reads unsent outbox rows and publishes to BullMQ + Redis pub/sub.
// Domain events delivered at-least-once. Consumers dedupe on event id.

export async function pollOutboxOnce({ publish, batchSize = 100 }) {
  // Atomically claim a batch of undelivered outbox rows by marking them in
  // a CTE. Using SKIP LOCKED ensures concurrent relays don't double-claim.
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
