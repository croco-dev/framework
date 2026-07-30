---
"@croco/metering-core": patch
---

Persist Redis usage records and dedupe markers atomically so transient and ambiguous writes remain safely retryable.
