---
"@croco/events-tx": patch
---

Cancel in-memory outbox reservation waits when the transaction or savepoint signal aborts, including transaction deadlines. Confirm rollback and release transaction reservations so callers can retry safely after cancellation.
