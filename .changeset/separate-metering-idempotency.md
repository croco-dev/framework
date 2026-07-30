---
"@croco/metering-core": patch
---

Keep Redis request lifecycle ownership separate from durable usage-record deduplication so composing `IdempotencyManager` and `RedisUsageStorage` on one Redis database persists quota and non-quota usage exactly once.

Lifecycle and record markers use the encoded `idem2:lifecycle:*` and `idem2:record:*` key spaces. This replaces the ambiguous legacy `idem:*` keys. Do not mix old and new metering writers during rollout: stop writers, wait for every legacy key to expire (including custom lifecycle and `isIdempotent()` TTLs), verify no legacy keys remain, and then start the new version. If that drain is not possible, block request-key retries across the upgrade boundary.
