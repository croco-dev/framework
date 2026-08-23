---
"@croco/cache-core": minor
"@croco/problems-core": patch
---

Generate deterministic, type-preserving decorator cache keys, make namespace eviction target the matching argument entry,
and reject unsupported argument graphs with a typed Problem.

External cache entries created with the previous argument serializer must be repopulated after upgrading. For mutations
that can invalidate multiple argument-derived entries, use a wildcard `key` or `allEntries: true`.
