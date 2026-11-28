---
"@croco/tenant-core": patch
---

Reject configured fallback tenant IDs in the active context before running tenant-scoped repository, query, or command work. Record the rejection with the existing tenant fallback Problem and policy decision trace.
