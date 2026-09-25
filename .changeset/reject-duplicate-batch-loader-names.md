---
"@croco/dataloader-core": patch
"@croco/problems-core": patch
---

Reject a different `createBatchLoader()` result that reuses another loader's name and scope within one request with `DuplicateBatchLoaderNameProblem` (`dataloader-core/duplicate-loader-name`), instead of silently returning the first loader's batches and cached results. Repeated calls to the same loader, `BatchLoaderFactory.create()` retrieval by name, and loaders outside a request context are unchanged; create each `createBatchLoader()` loader once and reuse it rather than recreating it per call inside a request.
