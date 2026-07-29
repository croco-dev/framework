---
"@croco/billing-core": minor
"@croco/billing-polar": patch
"@croco/problems-core": patch
"@croco/testing": minor
"create-croco-app": patch
---

Require stable checkout idempotency keys, coalesce concurrent equivalent tenant requests, replay completed results from a durable idempotency store, reject reused keys with different checkout inputs, and reconcile Polar sessions through provider operation metadata.
