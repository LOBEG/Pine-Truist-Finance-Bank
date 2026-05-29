# ============================================================
# Pine Bank — web (React/Vite) Dockerfile
# Stage 1: build the static bundle
# Stage 2: serve with a lightweight Node.js preview server
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install workspace dependencies needed for the web build
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/

RUN npm ci --workspace=apps/web --include-workspace-root

COPY apps/web/ ./apps/web/

ARG PINE_API_URL=/api/v1
ARG PINE_REALTIME_URL=

# Build the Vite bundle
RUN PINE_API_URL=${PINE_API_URL} PINE_REALTIME_URL=${PINE_REALTIME_URL} \
    npm --workspace=apps/web run build

# ---- Runner (serves pre-built static files) ----------------
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

RUN addgroup -S pine && adduser -S pine -G pine

WORKDIR /app

# Only copy the built dist and the minimal server manifest
COPY --from=builder --chown=pine:pine /app/apps/web/dist       ./apps/web/dist
COPY --from=builder --chown=pine:pine /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder --chown=pine:pine /app/apps/web/vite.config.js ./apps/web/vite.config.js
COPY --from=builder --chown=pine:pine /app/node_modules        ./node_modules
COPY --chown=pine:pine package.json ./

USER pine

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "--workspace=apps/web", "run", "preview"]
