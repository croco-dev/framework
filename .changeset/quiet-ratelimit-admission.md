---
"@croco/ratelimit-core": patch
---

In-memory rate limiters keep concurrent requests within each key's remaining quota and order refunds, resets and pruning with admission without blocking independent keys.
