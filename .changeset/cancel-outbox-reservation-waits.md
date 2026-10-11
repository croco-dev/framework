---
"@croco/events-tx": patch
---

Cancel in-memory outbox reservation waits when the transaction or savepoint signal aborts, including transaction deadlines. Confirm rollback and release transaction reservations so callers can retry safely after cancellation.

Remove cancelled waiters from held reservations immediately so repeated cancellation does not retain their callbacks or abort signals until the holder finishes.

Cancelled savepoints preserve messages committed by other transactions and changes staged by their ancestors. Conflicting committed-state refreshes fail explicitly instead of overwriting staged changes.
