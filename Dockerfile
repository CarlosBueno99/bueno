FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY convex/package.json ./convex/
RUN pnpm install --filter backend --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY convex/_generated ./convex/_generated
RUN cd backend && pnpm exec esbuild server/index.ts \
  --bundle --platform=node --outfile=dist/server.js --packages=external

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /app/backend/dist ./dist
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=appuser:nodejs /app/backend/node_modules ./backend/node_modules
COPY --chown=appuser:nodejs backend/package.json ./
USER appuser
EXPOSE 3000
ENV PORT=3000
CMD ["node", "dist/server.js"]
