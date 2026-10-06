---
"@croco/repository-core": patch
"@croco/dataloader-core": patch
---

- docs(repository-core,dataloader-core): document that `IBatchLoaderFactory.create()` retrieves by name, so direct callers must keep `batchFn` identical for a shared name or use a unique name per batch function
