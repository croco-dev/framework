---
"@croco/batch-qstash": minor
---

QStash distributed continuations now require a checkpointable reader. The exported `QStashStep` type narrows its reader to `ItemReader & Checkpointable`, and `validateQStashStep` rejects readers that lack `getCheckpoint` or `restoreCheckpoint` with a terminal `QStashBatchConfigProblem` before a continuation claim is acquired. Non-checkpointable reader fallbacks have been removed from checkpoint restore, staging, and has-more detection.
