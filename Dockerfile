FROM oven/bun:1 AS base
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# These are needed at build time by Vite
ARG VITE_CONVEX_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_SPOTIFY_CLIENT_ID

ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_SPOTIFY_CLIENT_ID=$VITE_SPOTIFY_CLIENT_ID

RUN bun run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 appuser

# Vite static output
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist

# Hono server source + generated Convex types
COPY --from=builder --chown=appuser:nodejs /app/server ./server
COPY --from=builder --chown=appuser:nodejs /app/convex/_generated ./convex/_generated

# Runtime deps only (includes steam-user, globaloffensive, hono, convex, etc.)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Any static public assets referenced by the app
COPY --from=builder --chown=appuser:nodejs /app/public ./public

# demo.json for /api/cs route (if present)
COPY --from=builder --chown=appuser:nodejs /app/app/demo.json* ./app/

USER appuser

EXPOSE 3000
ENV PORT=3000

CMD ["bun", "server/index.ts"]
