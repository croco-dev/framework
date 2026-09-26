---
"@croco/problems-core": patch
"@croco/retry-core": patch
"@croco/idempotency-core": patch
"@croco/workflow-core": patch
"@croco/triggers-qstash": patch
---

Honor an error's explicit retry classification in the default `@Retryable` and `RetryTemplate` policy. `DefaultRetryPolicy` now follows a top-level `retryable` boolean, then `extensions.retryable`, before `retryFor` and `ProblemCategory`, so an `InternalServerError` Problem with `extensions.retryable: false` runs once and a `Conflict` Problem with `extensions.retryable: true` retries while attempts remain. `noRetryFor` still wins, and errors without an explicit flag keep their previous classification. An explicit `false` is rethrown immediately like any other terminal failure, so it does not reach recovery callbacks, `@Recover` handlers, exhausted listeners, or `wrapExhausted`. An explicit `true` on a terminal category, such as `Conflict`, now exhausts its attempts and then reaches those same recovery paths instead of being rethrown on the first failure. An explicit flag also takes precedence over a caller's `retryFor` or `retryForCategories` list. The retry engine still wraps thrown non-`Error` values in an `Error`, so their flags do not reach the policy.

The flag is read by the new `readExplicitRetryability()` in `@croco/problems-core`, which idempotency handler failures, saga steps, and QStash triggers now share. Only boolean values count, `extensions.retryable` is read from any error object rather than only `Problem` instances, and a throwing accessor counts as no classification. As a result:

- Saga steps and QStash triggers ignore a non-boolean top-level `retryable` value (previously coerced), honor `extensions.retryable` on errors that are not `Problem` instances, and no longer fail classification when the `retryable` accessor throws. QStash triggers also honor a flag declared on a thrown function.
- `isRetryableHandlerFailure()`, the idempotency default classifier, now honors a `retryable` flag declared on a thrown function; previously any thrown non-object value was retryable. Its results for objects, including the Problem causes webhooks-core passes to it, are unchanged.

Each package's default for errors without an explicit flag is unchanged.
