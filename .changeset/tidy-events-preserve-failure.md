---
"@croco/events-inmemory": patch
"@croco/problems-core": patch
---

Preserve the original publish failure when dead-letter enqueue also fails. Return the storage error and recoverable item separately so callers retain the execution error's identity, code and retryability and can store the failed work after recovery.
