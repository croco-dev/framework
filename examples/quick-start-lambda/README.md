# Quick Start Lambda Example

Minimal Lambda-ready REST API using Croco Framework.

## Run Locally

```bash
pnpm install
pnpm dev
```

Then test:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","message":"Croco Quick Start is running!"}
```

## Deploy

Export the `handler` from `src/index.ts` as your AWS Lambda entry point.