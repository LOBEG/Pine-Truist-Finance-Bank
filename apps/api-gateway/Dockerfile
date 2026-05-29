# ============================================================
# Pine Bank — api-gateway Dockerfile
# Multi-stage build: deps → builder → runner (non-root)
# ============================================================

# ---- Stage 1: install all workspace dependencies ----------
FROM node:20-alpine AS deps

# Install native build tools for modules with native bindings (argon2, etc.)
RUN apk add --no-cache python3 make g++ libc-dev

WORKDIR /app

# Copy workspace manifests only (maximises layer cache)
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
COPY apps/api-gateway/package.json       apps/api-gateway/

RUN npm ci --omit=dev --ignore-scripts=false

# ---- Stage 2: copy source ----------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

# Non-root user for container security
RUN addgroup -S pine && adduser -S pine -G pine

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules          ./node_modules

# Copy source
COPY packages/ ./packages/
COPY apps/api-gateway/ ./apps/api-gateway/

# Drop root privileges
USER pine

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1

# dumb-init ensures proper signal handling and zombie reaping
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api-gateway/src/server.js"]
