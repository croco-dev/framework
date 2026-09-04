---
"@croco/events-core": patch
"@croco/events-inmemory": minor
"@croco/problems-core": patch
---

Retry exhausted in-memory event handlers through an opt-in dead-letter queue and replay only the failed handler with the original event identity.
