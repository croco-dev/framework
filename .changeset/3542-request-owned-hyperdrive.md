---
"@croco/tx-drizzle": minor
"@croco/problems-core": patch
"create-croco-app": patch
---

Run opt-in Hyperdrive transactions with request-owned PostgreSQL connections, bounded connection and statement budgets, redacted failures, and awaited cleanup. Live Cloudflare deployment and durable adapter conformance remain unverified.

The new `tx-drizzle/hyperdrive-transaction-failed` code is not retryable automatically: a committed outcome must not be replayed, and an unknown outcome needs reconciliation before any authorized retry.

The repository smoke Worker and CLI verify authenticated HTTP results against independent PostgreSQL state with run-scoped cleanup. Local workerd execution is recorded separately from unverified Cloudflare deployment, proxy behavior and certification.

`HYPERDRIVE_SMOKE_CHECK_FAILED` exposes a static verification diagnostic; inspect the safe report and reconcile its run UUID before an intentional new run.
