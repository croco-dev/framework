---
"@croco/batch-core": patch
---

Stop starting new batch writes after cooperative execution cancellation, including cancellation during reads or processing. Successful in-flight writes retain their existing checkpoint and progress evidence; cancellation does not complete or retry the execution.
