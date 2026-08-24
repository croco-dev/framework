---
"@croco/lifecycle-core": patch
"@croco/problems-core": patch
---

Keep in-memory lifecycle claims and run evidence stable when callers mutate stored inputs or returned results, and
report unsupported action metadata through a typed lifecycle Problem without retaining a partial snapshot.
