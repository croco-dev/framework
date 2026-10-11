---
"@croco/batch-qstash": patch
---

QStash chunk execution now preserves the original processor/read/write error when continuation failure recording rejects, attaching the recording failure as diagnostic evidence instead of replacing the root cause. Ownership-conflict fencing behavior is unchanged.
