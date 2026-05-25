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
COPY --from=builder /app/apps/web/dist       ./apps/web/dist
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/node_modules        ./node_modules
COPY package.json ./

USER pine

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "--workspace=apps/web", "run", "preview"]
