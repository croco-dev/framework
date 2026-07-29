---
"@croco/billing-polar": patch
"@croco/billing-core": patch
---

Publish direct Polar delinquency webhooks through a durable subscription-transition reservation so overlapping
notifications across workers emit once, failed publication remains retryable, and later recovery can open a new
past-due episode.

Define webhook failure cleanup as an idempotent removal across reserved, completed, and missing
reservations so persisted recovery state can safely retry transition-latch cleanup.
