---
"@croco/execution-core": patch
"@croco/problems-core": patch
"@croco/tasks-core": patch
---

Reject invalid execution attempt and timeout settings with a typed configuration Problem before storing an execution or starting a task. Preserve default attempts, zero and omitted timeouts, and long timeout scheduling.
