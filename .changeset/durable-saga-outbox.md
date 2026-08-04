---
"@croco/workflow-core": minor
---

Persist saga step and compensation outbox intents before dispatch, expose recoverable pending delivery, and retain deterministic idempotent delivery identities across retries and replays.

Custom saga stores must persist the new delivery identity, phase, status, and enqueue timestamp fields on outbox records. Publishers must deduplicate repeated delivery attempts by `deliveryId`.
