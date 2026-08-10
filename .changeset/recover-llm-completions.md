---
"@croco/llm-core": minor
"@croco/events-core": minor
"@croco/problems-core": patch
---

Keep completed generation output recoverable when completion-event delivery fails, expose the failure as non-retryable model work, and allow the stable event intent to be retried independently with optional durable intent tracking.
