FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN npx esbuild server/index.ts \
  --bundle --platform=node --outfile=dist/server.js --packages=external

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

USER appuser

CMD ["node", "dist/server.js"]
