---
"@croco/auth-core": minor
"@croco/auth-drizzle": minor
"@croco/problems-core": patch
---

API key rotation now atomically revokes the old credential, replays the same protected replacement for idempotent retries, and durably recovers post-commit rotation events.

Custom `ApiKeyStore` adapters must implement atomic rotation plus event claim, completion, and release operations. Callers must provide an idempotency key and configure an `ApiKeyRotationProtector`.

Deploy the rotation schema first, pause rotation traffic, drain every instance using the legacy save-then-revoke path, deploy the new writers, and only then resume rotation. Mixed legacy and atomic rotation writers are not supported.
