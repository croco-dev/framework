---
"@croco/ratelimit-core": patch
---

Preserve token-bucket quota and valid refund receipts when setting or expiring a counter TTL. Counter expiry no longer resets admission state, including when the counter does not exist.
