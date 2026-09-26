---
"@croco/billing-core": patch
"@croco/billing-polar": patch
---

Older Polar subscription webhooks no longer replace newer subscription state or publish stale domain events. Billing store adapters receive the provider timestamp and must ignore older updates for the same external subscription.
