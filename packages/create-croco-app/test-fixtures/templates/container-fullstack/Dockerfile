# Stage 1: Deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api-server/package.json ./apps/api-server/
COPY apps/console-web/package.json ./apps/console-web/
RUN corepack enable && pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

# Stage 3: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/apps/api-server/dist ./dist
COPY --from=build /app/apps/console-web/dist/client ./public
EXPOSE 3000
CMD ["node", "dist/index.js"]
