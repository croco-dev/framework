---
"@croco/billing-core": patch
"@croco/billing-polar": patch
"@croco/metrics-billing": patch
"@croco/problems-core": patch
---

Preserve event-time subscription and immutable recurring-price evidence on paid orders so delayed initial and reactivation payments record historical MRR. Legacy payments without evidence fail explicitly for historical repair and replay instead of using current subscription prices.
