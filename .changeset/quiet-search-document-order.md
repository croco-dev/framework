---
"@croco/search-core": patch
---

Keep index and delete effects for the same tenant, index and document in delivery order within one SearchAutoSync instance. Independent documents still progress concurrently, and failed events remain retryable.
