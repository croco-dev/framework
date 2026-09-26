---
"@croco/billing-polar": patch
---

Read the paid order amount from the Polar `net_amount` field (integer cents, after discounts and before taxes) instead of the nonexistent `amount` key, so SDK-shaped signed `order.paid` webhooks store one order and publish `OrderPaidEvent` with that amount, zero included. A missing, negative, or fractional `net_amount` is rejected as `WebhookValidationProblem` (HTTP 400) without saving or publishing.
