---
"@croco/storage-r2": patch
"@croco/problems-core": patch
---

Report explicit R2 NoSuchBucket read failures as a non-retryable configuration Problem instead of a missing object, preserving the upstream cause and error metadata.
