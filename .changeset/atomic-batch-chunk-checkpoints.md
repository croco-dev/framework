---
"@croco/batch-core": patch
"@croco/etl-core": patch
---

Batch retries restore the cursor and processed input count from the same committed checkpoint, including when no progress total is configured. When progress storage fails after the final checkpoint, retry restores the final progress without replaying that chunk. ETL pipelines also store their final cursor and input count together. Existing checkpoints with separate cursor and count keys remain readable.
