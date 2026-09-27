---
"@croco/billing-core": patch
"@croco/billing-polar": patch
"@croco/metrics-billing": patch
"@croco/metrics-core": patch
---

Revoked subscriptions record churn once per subscription, including period-end cancellations and exhausted payment retries. Revocation events retain the pinned plan version, and the metrics repository contract documents shared deduplication keys.
