---
"@croco/workflow-core": patch
---

Retry saga steps that throw standard JavaScript errors when a retry policy is configured, while preserving explicit non-retryable markers and custom retry decisions.
