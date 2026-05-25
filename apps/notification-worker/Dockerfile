# ============================================================
# Pine Bank — notification-worker Dockerfile
# ============================================================

FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++ libc-dev

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/lib-config/package.json    packages/lib-config/
COPY packages/lib-db/package.json        packages/lib-db/
COPY packages/lib-events/package.json    packages/lib-events/
COPY packages/lib-logger/package.json    packages/lib-logger/
COPY apps/notification-worker/package.json apps/notification-worker/

RUN npm ci --omit=dev --ignore-scripts=false

# ---- Runner ------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

RUN addgroup -S pine && adduser -S pine -G pine

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY packages/ ./packages/
COPY apps/notification-worker/ ./apps/notification-worker/

USER pine

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/notification-worker/src/worker.js"]
