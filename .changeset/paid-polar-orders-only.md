---
"@croco/billing-polar": patch
---

Persist Polar orders only after an `order.paid` webhook proves payment, while acknowledging other order lifecycle deliveries without paid-order side effects.
