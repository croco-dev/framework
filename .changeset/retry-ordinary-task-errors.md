---
"@croco/tasks-core": patch
---

Retry ordinary task handler errors while attempts remain, preserve explicit non-retryable failures, allow each task to classify otherwise unmarked errors with `isRetryable`, and keep completion persistence failures outside handler retries.
