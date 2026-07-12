---
"@croco/retry-core": patch
---

Make Redis circuit-breaker locks wait through bounded contention and release only the current owner's lease. Custom
Redis-compatible clients must support `eval` for atomic release.
