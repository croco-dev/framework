---
"@croco/events-tx": patch
---

Escape null bytes in persisted inbox and outbox failure details so PostgreSQL can record the failure instead of leaving the message claim unfinished.
