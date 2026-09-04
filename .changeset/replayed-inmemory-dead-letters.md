---
"@croco/events-core": patch
"@croco/events-inmemory": minor
"@croco/problems-core": patch
---

Retain exhausted event handling and handler initialization failures in an opt-in dead-letter queue. Replay only the failed handler with the original event identity and an explicit handler ID that survives rebuilds.
