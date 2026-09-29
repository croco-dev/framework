---
"@croco/lifecycle-core": patch
---

Webhook lifecycle actions now consume the response body on every completed request and keep the fixed `content-type` and `idempotency-key` headers immune to payload header overrides.
