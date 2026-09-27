---
"@croco/idempotency-core": patch
"@croco/webhooks-core": patch
"@croco/auth-clerk": patch
"@croco/auth-better-auth": patch
---

Webhook delivery reservations expire after a separate processing lease, so an abandoned attempt can be retried while completed results retain their configured replay period.
