---
"@croco/migration-runner": patch
---

Migration execution now requires transaction-capable clients for `up` and `down`, and claims checkpoints inside the same transaction as migration side effects so concurrent runners skip already-claimed work instead of applying the same migration body twice.
