---
"@croco/tx-drizzle": patch
---

Discard aborted pooled connections after node-postgres replaces their release function on a later checkout, while preserving healthy reuse and savepoint rollback.
