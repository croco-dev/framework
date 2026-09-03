---
"@croco/events-core": patch
"@croco/events-inmemory": minor
---

Retry exhausted in-memory event handlers through an opt-in dead-letter queue and replay only the failed handler with the original event identity.
