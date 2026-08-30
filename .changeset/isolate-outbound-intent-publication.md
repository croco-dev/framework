---
"@croco/webhooks-core": major
---

Continue publishing independent outbound webhook intents after retryable or terminal failures and
return a payload-free batch outcome while preserving fail-fast configuration errors. Store adapters
now mark intent publication atomically, and task publishers must honor the intent idempotency key.
