---
"@croco/transports-http": patch
---

Return the canonical `@croco/health-core` readiness contract from HTTP health endpoints.

`/ready` and `/health/ready` now return `{ status: "up" | "down", results: [...] }` instead of the previous transport-local `{ status: "ok" | "error", checks: ... }` body shape.
