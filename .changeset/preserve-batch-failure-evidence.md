---
"@croco/batch-core": patch
---

Preserve the original batch step failure when recording failed execution state also fails, and report the secondary recording failure without masking the root cause.
