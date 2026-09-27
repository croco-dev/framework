---
"@croco/idempotency-core": patch
"@croco/problems-core": patch
"@croco/webhooks-core": patch
"@croco/auth-clerk": patch
"@croco/auth-better-auth": patch
---

Webhook delivery reservations expire after a separate processing lease, so an abandoned attempt can be retried while completed results retain their configured replay period.

Better Auth senders can retry beyond the legacy five-minute body timestamp window by signing an unchanged event body with a fresh `x-better-auth-timestamp` and a `v1` delivery signature on each attempt.

Expose `processingLeaseMs` in BetterAuth webhook options so applications can choose a lease longer than their maximum handler duration.

Custom webhook idempotency stores must implement independent lease expiry and declare `processingLeaseVersion: 1`; incompatible stores fail during configuration instead of silently retaining abandoned deliveries.
