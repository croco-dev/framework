---
"@croco/problems-core": patch
"@croco/retry-core": patch
"@croco/idempotency-core": patch
"@croco/workflow-core": patch
"@croco/triggers-qstash": patch
---

Honor an error's explicit retry classification in the default `@Retryable` and `RetryTemplate` policy. `DefaultRetryPolicy` now follows a top-level `retryable` boolean, then `extensions.retryable`, before `retryFor` and `ProblemCategory`, so an `InternalServerError` Problem with `extensions.retryable: false` runs once and a `Conflict` Problem with `extensions.retryable: true` retries while attempts remain. `noRetryFor` still wins, and errors without an explicit flag keep their previous classification.

The flag is read by the new `readExplicitRetryability()` in `@croco/problems-core`, which idempotency handler failures, saga steps, and QStash triggers now share. Only boolean values count, `extensions.retryable` is read from any error object rather than only `Problem` instances, and a throwing accessor counts as no classification. As a result, saga steps and QStash triggers now ignore a non-boolean top-level `retryable` value (previously coerced with `Boolean()`), honor `extensions.retryable` on errors that are not `Problem` instances, and no longer fail classification when the `retryable` accessor throws. Their defaults for errors without an explicit flag are unchanged.
