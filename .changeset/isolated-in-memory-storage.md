---
"@croco/storage-core": patch
---

Prevent callers from mutating objects stored by `InMemoryStorageProvider` through uploaded bytes, read results, streams, or metadata references.
