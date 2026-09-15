---
"@croco/outbox-core": patch
---

Stop reclaiming expired in-memory outbox records after their retry budget is exhausted, persist terminal failure evidence, and allow healthy records to continue through the queue.
