---
"@croco/billing-core": minor
"@croco/billing-polar": minor
"@croco/metrics-billing": patch
"@croco/problems-core": patch
"create-croco-app": minor
---

Subscriptions now pin an explicit immutable plan version, historical pricing returns identified
versions, and Polar webhooks reject unknown product and price mappings before persistence.

Existing subscription records require an explicitly selected matching version reference; migration
never falls back to the latest published version.
