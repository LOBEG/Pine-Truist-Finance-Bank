# ============================================================
# Pine Bank — realtime-gateway Dockerfile
# WebSocket / Socket.IO service
# ============================================================

FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++ libc-dev

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/lib-auth/package.json      packages/lib-auth/
COPY packages/lib-config/package.json    packages/lib-config/
COPY packages/lib-events/package.json    packages/lib-events/
COPY packages/lib-http/package.json      packages/lib-http/
COPY packages/lib-logger/package.json    packages/lib-logger/
COPY apps/realtime-gateway/package.json  apps/realtime-gateway/

RUN npm ci --omit=dev --ignore-scripts=false

# ---- Runner ------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

RUN addgroup -S pine && adduser -S pine -G pine

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY packages/ ./packages/
COPY apps/realtime-gateway/ ./apps/realtime-gateway/

USER pine

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/realtime-gateway/src/server.js"]
