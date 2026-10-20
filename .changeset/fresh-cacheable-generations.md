---
"@croco/cache-core": patch
---

Start fresh Cacheable loads after invalidation without losing original results for existing waiters. Keep singleflight and invalidation generations in the store, with per-caller preservation of invalidated getOrSet results.
