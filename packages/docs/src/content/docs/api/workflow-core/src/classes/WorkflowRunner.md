---
editUrl: false
next: false
prev: false
title: "WorkflowRunner"
---

## Constructors

### Constructor

> **new WorkflowRunner**(`executionManager`, `registry?`, `taskRunner?`): `WorkflowRunner`

#### Parameters

##### executionManager

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)

##### registry?

[`WorkflowRegistry`](/api/workflow-core/src/classes/workflowregistry/) = `...`

##### taskRunner?

[`TaskRunner`](/api/tasks-core/src/classes/taskrunner/) = `...`

#### Returns

`WorkflowRunner`

## Methods

### cancel()

> **cancel**(`executionId`, `reason?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### executionId

`string`

##### reason?

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### execute()

#### Call Signature

> **execute**\<`TPayload`, `TSteps`\>(`workflow`, `payload`): `Promise`\<[`TypedWorkflowRunResult`](/api/workflow-core/src/type-aliases/typedworkflowrunresult/)\<`TSteps`\>\>

##### Type Parameters

###### TPayload

`TPayload`

###### TSteps

`TSteps` _extends_ readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[]

##### Parameters

###### workflow

[`TypedWorkflowReference`](/api/workflow-core/src/type-aliases/typedworkflowreference/)\<`TPayload`, `TSteps`\>

###### payload

`NoInfer`\<`TPayload`\>

##### Returns

`Promise`\<[`TypedWorkflowRunResult`](/api/workflow-core/src/type-aliases/typedworkflowrunresult/)\<`TSteps`\>\>

#### Call Signature

> **execute**(`workflowName`, `payload`): `Promise`\<[`WorkflowRunResult`](/api/workflow-core/src/type-aliases/workflowrunresult/)\>

##### Parameters

###### workflowName

`string`

###### payload

`unknown`

##### Returns

`Promise`\<[`WorkflowRunResult`](/api/workflow-core/src/type-aliases/workflowrunresult/)\>

---

### replay()

> **replay**(`executionId`, `params?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### executionId

`string`

##### params?

[`ReplayExecutionParams`](/api/execution-core/src/interfaces/replayexecutionparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>
