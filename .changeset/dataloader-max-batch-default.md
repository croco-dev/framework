---
"@croco/dataloader-core": patch
---

Stop splitting dataloader batches by default so omitted `maxBatchSize` matches the documented unlimited batching contract.
