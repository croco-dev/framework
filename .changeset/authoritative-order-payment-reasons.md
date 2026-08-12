---
"@croco/billing-core": minor
"@croco/billing-polar": minor
"@croco/metrics-billing": minor
"@croco/problems-core": patch
---

Carry an authoritative payment reason on paid-order events so subscription renewals no longer inflate new MRR and explicit reactivations record reactivation MRR.

`OrderPaidEvent` consumers must now pass a fifth `reason` argument. Use `subscription_create` for initial activation, `subscription_cycle` for renewal, `subscription_reactivation` only when the provider supplies authoritative reactivation evidence, `subscription_update` for plan-change charges, and `one_time` for non-subscription purchases.

This contract does not support a mixed-version rolling deployment. Pause and drain old consumers, migrate queued/outbox `OrderPaidEvent` payloads with authoritative provider data, deploy compatible producers and consumers together, then resume consumption. Missing or unknown reasons now fail with `metrics-billing/invalid-order-payment-reason`; do not replay legacy payloads until they have been enriched.
