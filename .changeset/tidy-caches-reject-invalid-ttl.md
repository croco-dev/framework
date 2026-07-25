---
"@croco/cache-core": patch
"@croco/problems-core": patch
---

Reject non-finite and negative in-memory cache TTLs before mutation, define zero as immediate expiration, and register
the new cache TTL validation Problem.
