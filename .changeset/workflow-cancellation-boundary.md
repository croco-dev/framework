---
"@croco/workflow-core": patch
"@croco/problems-core": patch
---

Stop dispatching subsequent workflow tasks after persisted cancellation and report a non-retryable cancellation Problem while preserving the cancelled parent execution.
