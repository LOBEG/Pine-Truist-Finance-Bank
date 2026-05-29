import http from 'node:http';
import express from 'express';
import { Server as IOServer } from 'socket.io';
import { createAdapter } from '@socket.io/postgres-adapter';
import { loadConfig } from '@pine/lib-config';
import { createLogger } from '@pine/lib-logger';
import { createJwtVerifier } from '@pine/lib-auth/jwt';
import { CHANNELS, createSubscriber } from '@pine/lib-events';
import { healthRoutes } from '@pine/lib-http';
import { createPool, getPool, query } from '@pine/lib-db';

const config = loadConfig({ serviceName: 'realtime-gateway' });
const logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
  env: config.env,
});

// Database connection is required to enforce account-room ownership and for socket.io adapter.
createPool({ url: config.database.url, ssl: config.database.ssl });

const verifyJwt = createJwtVerifier({
  publicKeyB64: config.jwt.publicKeyB64,
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
});

const app = express();
healthRoutes(app, {
  db: async () => {
    await query('SELECT 1');
  },
});
const httpServer = http.createServer({ maxHeaderSize: config.http.maxHeaderSizeBytes }, app);

const _corsOrigins = (config.cors.origins || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const io = new IOServer(httpServer, {
  path: '/realtime',
  cors: { origin: _corsOrigins.length ? _corsOrigins : true, credentials: true },
  pingInterval: 25_000,
  pingTimeout: 30_000,
});

// Use Postgres adapter for Socket.IO (requires socket_io_attachments table).
// The migration creates this table. The adapter uses LISTEN/NOTIFY for coordination.
const pool = getPool();
io.adapter(createAdapter(pool));

// JWT-validated handshake. Token may be in `auth.token` or query.
io.use((socket, next) => {
  const token =
    (socket.handshake.auth && socket.handshake.auth.token) || socket.handshake.query?.token;
  if (!token) return next(new Error('missing_token'));
  try {
    const claims = verifyJwt(token);
    socket.data.userId = claims.sub;
    socket.data.roles = claims.roles || [];
    socket.data.permissions = claims.permissions || [];
    return next();
  } catch (e) {
    return next(new Error(`invalid_token: ${e.message}`));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  const userRoom = `user:${userId}`;
  socket.join(userRoom);
  if (
    socket.data.roles?.some((r) =>
      ['admin', 'super_admin', 'support', 'compliance_officer'].includes(r),
    )
  ) {
    socket.join('admin:global');
  }
  logger.info({ userId, sid: socket.id, roles: socket.data.roles }, 'socket connected');

  // Client-requested account room subscription. The server verifies — via the
  // database — that the requesting user owns the account before joining the
  // room. This prevents cross-account event leakage: a malicious client
  // cannot subscribe to account rooms it does not own, even with a valid JWT.
  socket.on('subscribe:account', async (accountId, ack) => {
    try {
      if (typeof accountId !== 'string' || !/^[0-9a-f-]{36}$/.test(accountId)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'invalid_account_id' });
        return;
      }
      const { rows } = await query(`SELECT user_id FROM accounts WHERE id = $1`, [accountId]);
      if (!rows[0] || rows[0].user_id !== userId) {
        logger.warn({ userId, accountId }, 'rejected account room subscription (not owner)');
        if (typeof ack === 'function') ack({ ok: false, error: 'not_owner' });
        return;
      }
      socket.join(`account:${accountId}`);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      logger.error({ err: err.message, userId, accountId }, 'subscribe:account failed');
      if (typeof ack === 'function') ack({ ok: false, error: 'internal_error' });
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info({ sid: socket.id, userId, reason }, 'socket disconnected');
  });
});

// Fan-out from Postgres LISTEN/NOTIFY channels (no Redis).
createSubscriber(config.database.url, {
  channels: Object.values(CHANNELS),
  logger,
  onMessage: (channel, msg) => {
    const { topic, userId, accountId } = msg;
    // Send to user-specific room.
    if (userId) io.to(`user:${userId}`).emit(topic, msg);
    if (accountId) io.to(`account:${accountId}`).emit(topic, msg);

    // Admin global feed sees withdrawals/fraud/compliance.
    if (
      topic.startsWith('withdrawal.') ||
      topic.startsWith('fraud.') ||
      topic.startsWith('compliance.') ||
      topic === 'transaction.flagged'
    ) {
      io.to('admin:global').emit(topic, msg);
    }
  },
});

httpServer.listen(config.port, () => {
  logger.info({ port: config.port }, 'realtime-gateway listening');
});

async function gracefulShutdown(signal) {
  logger.info({ signal }, 'shutting down');
  io.close();
  httpServer.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
