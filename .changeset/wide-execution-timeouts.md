---
"@croco/execution-drizzle": patch
---

Store execution timeouts above the PostgreSQL 32-bit integer range without changing the `number` API contract. Existing databases must widen `executions.timeout` to `bigint` before deploying this version.
