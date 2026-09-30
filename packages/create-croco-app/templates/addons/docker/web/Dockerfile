FROM node:24-slim AS base
RUN npm install -g pnpm turbo

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune {{webPackageName}} --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter={{webPackageName}}

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs
COPY --from=builder --chown=nodejs:nodejs /app/apps/{{webAppName}}/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/{{webAppName}}/.next/static ./apps/{{webAppName}}/.next/static
COPY --from=builder --chown=nodejs:nodejs /app/apps/{{webAppName}}/public ./apps/{{webAppName}}/public
USER nodejs
EXPOSE 3000
CMD ["node", "apps/{{webAppName}}/server.js"]
