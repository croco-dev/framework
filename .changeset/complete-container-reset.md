---
"@croco/framework-context": patch
"@croco/problems-core": patch
---

Container.reset attempts cleanup for every registered value and generated transient/singleton, clears registrations even when cleanup fails, and reports all failures through a `framework-context/container-reset-failed` Problem with an AggregateError cause. This code is not retryable: a repeated reset cannot retry destructors after registrations have been cleared.

The serialized cleanup summary includes up to 100 messages with total and omitted counts. Each message preview is limited to 2048 UTF-16 code units and marks truncation; the AggregateError cause retains every original thrown value unchanged.
