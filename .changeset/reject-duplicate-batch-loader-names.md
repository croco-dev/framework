---
"@croco/dataloader-core": patch
"@croco/problems-core": patch
---

Reject a different `createBatchLoader()` result that reuses another loader's name and scope within one request with `DuplicateBatchLoaderNameProblem` (`dataloader-core/duplicate-loader-name`), instead of silently returning the first loader's batches and cached results. Repeated calls to the same loader, `BatchLoaderFactory.create()` retrieval by name, and loaders outside a request context are unchanged; create each `createBatchLoader()` loader once and reuse it rather than recreating it per call inside a request. Custom `IBatchLoaderFactory` implementations that are called per invocation, such as through `@BatchLoad`, should delegate to `BatchLoaderFactory` instead of `createBatchLoader()`. Request cache keys now encode name, scope, and dynamic scope unambiguously, so different loaders whose name and scope strings only matched after delimiter concatenation no longer share a cache.
