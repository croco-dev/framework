---
"@croco/tasks-core": patch
"@croco/problems-core": patch
---

Return a typed recovery Problem when an idempotent task call finds a failed, cancelled, or timed-out execution instead of exposing an execution state-machine error, and publish its generated registry entry.
