FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 appuser

COPY --from=deps  --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --chown=appuser:nodejs ./server ./server
COPY --chown=appuser:nodejs ./convex/_generated ./convex/_generated
COPY --chown=appuser:nodejs package.json ./

USER appuser

EXPOSE 3000
ENV PORT=3000

CMD ["node", "--import", "tsx/esm", "server/index.ts"]
