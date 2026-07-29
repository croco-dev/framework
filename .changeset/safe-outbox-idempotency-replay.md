---
"@croco/events-tx": patch
"@croco/problems-core": patch
---

Reject outbox idempotency-key reuse when the canonical event request differs, including concurrent in-memory and Drizzle appends.
