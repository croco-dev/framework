---
"@croco/billing-core": minor
"@croco/billing-polar": minor
"@croco/metrics-billing": patch
"create-croco-app": patch
"@croco/problems-core": patch
---

Subscriptions now remain pinned to immutable, serializable plan versions. Billing stores expose an explicit legacy migration contract, Polar webhooks resolve product and price bindings without guessing the latest plan, and billing metrics use the subscription's pinned version.
