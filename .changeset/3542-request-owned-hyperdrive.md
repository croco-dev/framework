---
"@croco/tx-drizzle": minor
"@croco/problems-core": patch
"create-croco-app": patch
---

Run opt-in Hyperdrive transactions with request-owned PostgreSQL connections, bounded connection and statement budgets, redacted failures, and awaited cleanup. Live Cloudflare deployment and durable adapter conformance remain unverified.

The new `tx-drizzle/hyperdrive-transaction-failed` code is not retryable automatically: a committed outcome must not be replayed, and an unknown outcome needs reconciliation before any authorized retry.
