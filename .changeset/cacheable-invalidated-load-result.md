---
"@croco/cache-core": patch
---

`@Cacheable` now returns the loaded method result when an overlapping invalidation discards the store write, and shares that result with singleflight waiters instead of surfacing `undefined`.
