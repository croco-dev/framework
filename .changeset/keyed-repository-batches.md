---
"@croco/repository-core": minor
"@croco/tx-drizzle": minor
"@croco/cli": patch
"@croco/problems-core": patch
"create-croco-app": patch
---

Make bulk repository reads return explicit keyed partial results, and reject duplicate, unexpected, unkeyed, or identity-mismatched batch entries before they can be assigned to callers.

Custom `ReadRepository` and `AbstractDrizzleRepository` implementations must return `{ key, value }` entries from `findByIds`; omit entries for missing IDs.
