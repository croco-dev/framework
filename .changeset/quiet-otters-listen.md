---
"@croco/events-tx": patch
---

Keep nested in-memory outbox and inbox values isolated across writes, reads, claims, transactions and savepoints. Unsupported executable values and opaque instances now fail with OutboxStorageProblem before storage changes; convert them to plain data before writing.
