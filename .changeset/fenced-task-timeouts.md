---
"@croco/execution-core": minor
"@croco/execution-drizzle": minor
"@croco/tasks-core": minor
"@croco/admin-ops": patch
"@croco/problems-core": patch
---

Timed-out task attempts now block retry and replay until the abandoned handler settles, an explicit idempotent or fenced contract permits overlap, or an operator records recovery. Croco-managed task results use atomic attempt tokens so stale attempts cannot commit a newer run.
