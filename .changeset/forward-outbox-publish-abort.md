---
"@croco/events-tx": patch
---

Forward relay cancellation to the EventBus so an outbox publication waiting for capacity can stop before its handler starts.
