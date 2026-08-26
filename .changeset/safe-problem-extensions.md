---
"@croco/admin-core": patch
"@croco/billing-polar": major
"@croco/cache-core": patch
"@croco/engagement-core": patch
"@croco/execution-core": patch
"@croco/framework-module": patch
"@croco/governance-core": patch
"@croco/idempotency-core": patch
"@croco/invitation-core": major
"@croco/llm-metering": patch
"@croco/llm-openai": major
"@croco/metering-core": patch
"@croco/notifications-core": patch
"@croco/notifications-resend": major
"@croco/problems-core": major
"@croco/search-meilisearch": major
"@croco/storage-cloudflare": major
"@croco/storage-cloudinary": major
"@croco/testing": major
"@croco/webhooks-core": major
"@croco/workflow-core": patch
---

Reject Problem extensions that could override core fields or fail JSON serialization while preserving nested JSON-safe data. Problem evidence is now immutable after construction, and optional evidence is omitted instead of being emitted as `undefined`.

Provider HTTP diagnostics now expose `upstreamStatus` instead of the reserved `status` extension. Invitation state uses `invitationStatus`, outbound webhook state uses `deliveryStatus`, and runtime contract mismatch evidence uses `baselineCanonical` and `actualCanonical` instead of `baseline` and `actual`. Consumers that inspect these diagnostic extensions must migrate to the new field names.
