---
"@croco/credits-drizzle": minor
"@croco/problems-core": patch
---

Persist credit ledger commands atomically through `TxManager` with PostgreSQL row locking, deterministic
history, bounded lot processing, durable idempotency, and database-enforced account isolation.
