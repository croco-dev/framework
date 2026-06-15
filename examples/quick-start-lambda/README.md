# Quick Start Lambda Example

Croco SaaS Backend Demo — Auth + Metering on AWS Lambda, wired with `@croco/auth-core`, `@croco/metering-core`, `@croco/protocols-rest`, and `@croco/transports-http`.

## Run Locally

```bash
pnpm install
pnpm dev
```

Then test the endpoints:

**Health check (no auth required):**

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{ "status": "ok" }
```

**List users (requires auth header):**

```bash
curl -H "x-api-key: test-key" http://localhost:3000/api/users
```

Expected response: `200` with user list.

**Create user (requires auth header, triggers metering):**

```bash
curl -X POST -H "x-api-key: test-key" -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}' \
  http://localhost:3000/api/users
```

Expected response: `200` with created user. The `api_user_create` meter records the event.

> **Auth note**: Endpoints without `x-api-key: test-key` return `401`.

## Validate

From the repository root, run the same smoke command used by CI:

```bash
pnpm quick-start-lambda:smoke
```

The smoke installs the example dependency closure, typechecks the example, starts `pnpm dev`, and verifies
health, auth, list, and create endpoints without real cloud credentials.

## Deploy

Export the `handler` from `src/index.ts` as your AWS Lambda entry point.

## Prerequisites

- Node.js >= 18
- pnpm (install via `corepack enable && corepack prepare pnpm@latest --activate`)
