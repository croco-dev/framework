---
"@croco/search-core": patch
---

Preserve per-document arrival order for overlapping automatic index and delete operations within one SearchAutoSync instance, while retaining independent-document concurrency and failed-event retries.
