---
"@croco/billing-polar": patch
"@croco/problems-core": patch
---

Accept every Polar SDK subscription status and report unsupported billing states with non-retryable `BILLING_STATUS_MAPPING_FAILED` diagnostics. Preserve revocation for legacy input and canceled subscription.revoked events.
