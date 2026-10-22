---
"@croco/metrics-core": minor
"@croco/metrics-billing": minor
"@croco/problems-core": patch
---

Keep subscription MRR tied to immutable pricing across plan version releases and historical snapshot recalculation. SubscriptionSnapshot now requires pricingRef and PlanProvider resolves getPlanVersion(pricingRef); migrate billing snapshots with subscription.planVersionRef. Missing or mismatched pricing fails explicitly instead of using current prices or omitting subscriptions.
