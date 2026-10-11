---
"@croco/tasks-core": patch
"@croco/workflow-core": patch
---

Workflows resume the same execution when a step fails with a Problem that declares `extensions.retryable: true` and its child task can retry. Keyless workflows and exhausted child tasks retain the original failure in a replayable failed workflow record.
