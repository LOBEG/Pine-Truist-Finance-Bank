# ============================================================
# Pine Bank — core-banking-api Dockerfile
# Multi-stage build: deps → runner (non-root)
# Pre-deploy command: npm run migrate:deploy
# ============================================================

FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++ libc-dev

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/lib-auth/package.json      packages/lib-auth/
COPY packages/lib-config/package.json    packages/lib-config/
COPY packages/lib-crypto/package.json    packages/lib-crypto/
COPY packages/lib-db/package.json        packages/lib-db/
COPY packages/lib-events/package.json    packages/lib-events/
COPY packages/lib-http/package.json      packages/lib-http/
COPY packages/lib-ledger/package.json    packages/lib-ledger/
COPY packages/lib-logger/package.json    packages/lib-logger/
COPY packages/lib-queue/package.json     packages/lib-queue/
COPY packages/lib-validation/package.json packages/lib-validation/
COPY apps/core-banking-api/package.json  apps/core-banking-api/

RUN npm ci --omit=dev --ignore-scripts=false

# ---- Runner ------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

RUN addgroup -S pine && adduser -S pine -G pine

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Also copy db CLI and migrations (needed for preDeployCommand)
COPY packages/ ./packages/
COPY apps/core-banking-api/ ./apps/core-banking-api/
COPY db/ ./db/

USER pine

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/core-banking-api/src/server.js"]
