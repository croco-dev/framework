---
"@croco/events-tx": patch
---

Replay an existing outbox message when the same idempotency key, event identity, payload, and metadata are retried with a different occurrence timestamp. Preserve the first stored timestamp and continue rejecting changes to eventId, eventType, aggregateId, payload, or metadata.
