---
"@croco/retry-core": patch
---

Preserve the original operation failure and retry classification when circuit state bookkeeping fails, and report the store failure through the existing bookkeeping trace event.
