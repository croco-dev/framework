---
"@croco/cli": patch
"@croco/diagnostics-core": patch
"@croco/problems-core": patch
---

Jobs show, logs, cancel, and replay reject empty and dot-segment job IDs before dispatch, preventing URL normalization from targeting another endpoint. The Problem registry includes the invalid job ID diagnostic.
