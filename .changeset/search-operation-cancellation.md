---
"@croco/search-core": minor
"@croco/search-drizzle": patch
"@croco/search-meilisearch": patch
"@croco/problems-core": patch
---

Expose one `SearchOperationOptions.signal` contract across search, document, bulk, and index-management I/O. Built-in adapters now reject pre-aborted work before provider access, and Meilisearch forwards the caller signal through requests and task polling with stable cancellation evidence.
