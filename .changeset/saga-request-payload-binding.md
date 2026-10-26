---
"@croco/workflow-core": patch
---

Bind keyed Saga executions to canonical request payloads so changed requests fail with an idempotency conflict instead of reusing earlier effects or results.
