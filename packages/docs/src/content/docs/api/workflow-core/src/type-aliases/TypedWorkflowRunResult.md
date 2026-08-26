---
editUrl: false
next: false
prev: false
title: "TypedWorkflowRunResult"
---

> **TypedWorkflowRunResult**\<`TSteps`\> = \{ `executionId`: `string`; `result`: [`WorkflowCompletionResult`](/api/workflow-core/src/type-aliases/workflowcompletionresult/)\<`TSteps`\>; `reused`: `false`; `steps`: `TSteps`; `workflow`: [`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/); \} \| \{ `executionId`: `string`; `result?`: `unknown`; `reused`: `true`; `steps`: readonly \[\]; `workflow`: [`WorkflowDefinition`](/api/workflow-core/src/type-aliases/workflowdefinition/); \}

## Type Parameters

### TSteps

`TSteps` _extends_ readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[]
