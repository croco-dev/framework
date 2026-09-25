---
"@croco/webhooks-core": patch
"@croco/idempotency-core": minor
"@croco/problems-core": patch
---

Keep a handler or unknown-event reporter Problem's retry classification when the webhook gateway wraps it, so a non-retryable failure is recorded once and redelivered events return the stored failure without running the handler again. `WebhookDispatchProblem` and `WebhookReporterProblem` now carry `extensions.retryable` from a Problem cause, and `@croco/idempotency-core` exports its default rule as `isRetryableHandlerFailure`.
