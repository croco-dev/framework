---
"@croco/tasks-core": major
"@croco/workflow-core": major
---

Execute named `@Task` handlers using their original Symbol method keys, including when a workflow uses the task name as a step. The registry rejects duplicate task names registered for different Symbol methods, even when their descriptions match.

`RegisteredTask.methodName` now has type `string | symbol`, including through `WorkflowRegistry.taskRegistry`. Narrow the key to `string` before calling string methods, or use `String(methodName)` to display it. Upgrade `@croco/tasks-core` and `@croco/workflow-core` together when passing task registries or runners between them.
