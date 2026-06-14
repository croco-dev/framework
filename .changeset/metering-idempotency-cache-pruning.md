---
"@croco/metering-core": patch
---

Bound the Redis usage storage local idempotency cache and prune expired entries during later writes so long-running processes do not retain stale record keys indefinitely.
