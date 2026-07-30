---
"@croco/execution-core": minor
"@croco/execution-drizzle": minor
"@croco/problems-core": patch
"@croco/tasks-core": patch
---

Scope every task idempotency key to the task contract, persist canonical request fingerprints, and reject reuse with a
different execution type or payload. Before deploying `@croco/execution-drizzle`, add
`executions.request_fingerprint varchar(64) null`, then drain every old task writer before starting the new version.
Mixed old/new task writers are unsupported because reservation across legacy and scoped keys is not atomic.
