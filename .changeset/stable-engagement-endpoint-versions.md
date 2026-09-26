---
"@croco/engagement-core": patch
"@croco/engagement-drizzle": patch
---

Keep an endpoint's version stable when its delivery target is unchanged, so terminal delivery events can invalidate it and send retries retain the same idempotency key.
