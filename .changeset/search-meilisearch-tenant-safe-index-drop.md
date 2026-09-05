---
"@croco/search-meilisearch": patch
---

Reject physical index deletion in tenant contexts to preserve every tenant's documents in shared indexes. System callers without a tenant must now explicitly pass `{ allowGlobalDrop: true }` to `deleteIndex`; existing calls without this option fail with `MeilisearchInvalidRequestProblem`.
