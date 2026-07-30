---
"@croco/billing-core": minor
"@croco/billing-polar": minor
"@croco/testing": minor
"@croco/problems-core": patch
---

Billing providers now expose inspectable checkout and usage capability profiles, provider-neutral
batch usage receipts and customer meter state, and a stable Problem when runtime-selected
capabilities are unavailable.

Provider certification can require checkout and usage independently, while Polar explicitly
declares that usage delivery is not yet supported.
