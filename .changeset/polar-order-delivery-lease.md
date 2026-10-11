---
"@croco/billing-polar": patch
---

Respond to concurrent `order.paid` redeliveries with a retryable failure until the active delivery claim completes, and reclaim interrupted claims after their lease expires.
