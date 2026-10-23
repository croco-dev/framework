---
"@croco/admin-ops": patch
"@croco/execution-core": patch
"@croco/execution-drizzle": patch
---

Reuse one durable replay for matching recovery requests across consoles and restarts, and reject conflicting intent under the same source/key while preserving audit evidence and atomically binding matching legacy receipts.
