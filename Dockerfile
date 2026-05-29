FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src/cron ./src/cron
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/node_modules/.package-lock.json ./node_modules/.package-lock.json

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["npx", "tsx", "server.ts"]
