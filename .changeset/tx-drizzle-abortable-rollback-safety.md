---
"@croco/tx-drizzle": patch
"@croco/tx-core": patch
---

Wait for in-flight database operations to settle before executing transaction or savepoint rollback on timeout abort, prevent connection pool contamination by discarding tainted sockets, and defend nested transaction tracking counters.
