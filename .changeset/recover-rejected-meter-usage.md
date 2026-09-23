---
"@croco/metering-core": patch
"create-croco-app": patch
---

Persist quota-rejected Redis usage exactly once when the same idempotency key is retried after over-quota recording becomes allowed, preserve recoverable billing intents until that retry succeeds, and continue to replay legacy deduplication markers.
