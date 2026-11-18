---
"@croco/metrics-core": major
"@croco/admin-core": major
"@croco/admin-react": patch
---

Experiment reviews return `null` when a primary, exposure-conditional, or slice mean has no usable outcomes. Callers of the review API and admin snapshot should handle `null` before using an estimate in arithmetic. The console displays these estimates as unavailable and continues to display observed zeros as `0`. Complete binary observations retain their existing zero-imputation behavior.

The per-variant availability field still describes the collection watermark. The coverage check warns if a primary mean is unavailable, even when the watermark covers the planned window.
