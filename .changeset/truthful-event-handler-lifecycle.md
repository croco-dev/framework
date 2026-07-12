---
"@croco/events-inmemory": patch
---

Keep active event handlers visible to concurrency limits and graceful shutdown until their promises settle, even when subscriptions are removed or cleared.
