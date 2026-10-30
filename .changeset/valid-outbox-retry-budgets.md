---
"@croco/outbox-core": patch
"@croco/problems-core": patch
---

Reject outbox retry budgets that are not positive safe integers before recording an intent or reserving its idempotency key. Direct and Unit of Work writes return `outbox-core/retry-configuration-invalid`; omitted budgets retain the default of three attempts.
