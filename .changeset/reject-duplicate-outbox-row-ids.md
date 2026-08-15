---
"@croco/events-tx": patch
"@croco/problems-core": patch
---

Reject outbox message ID reuse across idempotency keys with a stable conflict Problem while preserving the original message and lookup indexes.
