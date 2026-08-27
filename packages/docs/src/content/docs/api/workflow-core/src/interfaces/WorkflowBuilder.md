---
editUrl: false
next: false
prev: false
title: "WorkflowBuilder"
---

## Type Parameters

### TPayload

`TPayload`

### TPreviousResults

`TPreviousResults` *extends* readonly [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)[]

## Methods

### build()

> **build**(): [`TypedWorkflowReference`](/api/workflow-core/src/type-aliases/typedworkflowreference/)\<`TPayload`, `TPreviousResults`\>

#### Returns

[`TypedWorkflowReference`](/api/workflow-core/src/type-aliases/typedworkflowreference/)\<`TPayload`, `TPreviousResults`\>

***

### step()

#### Call Signature

> **step**\<`TTask`\>(`task`, ...`resolver`): `WorkflowBuilder`\<`TPayload`, readonly \[`TPreviousResults`, [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)\<[`TaskReferenceName`](/api/tasks-core/src/type-aliases/taskreferencename/)\<`TTask`\>, [`TaskReferenceName`](/api/tasks-core/src/type-aliases/taskreferencename/)\<`TTask`\>, [`TaskReferenceResult`](/api/tasks-core/src/type-aliases/taskreferenceresult/)\<`TTask`\>\>\]\>

##### Type Parameters

###### TTask

`TTask` *extends* [`TaskReference`](/api/tasks-core/src/type-aliases/taskreference/)

##### Parameters

###### task

`TTask`

###### resolver

...`WorkflowStepResolverArguments`\<`TPayload`, `TPreviousResults`, `TTask`\>

##### Returns

`WorkflowBuilder`\<`TPayload`, readonly \[`TPreviousResults`, [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)\<[`TaskReferenceName`](/api/tasks-core/src/type-aliases/taskreferencename/)\<`TTask`\>, [`TaskReferenceName`](/api/tasks-core/src/type-aliases/taskreferencename/)\<`TTask`\>, [`TaskReferenceResult`](/api/tasks-core/src/type-aliases/taskreferenceresult/)\<`TTask`\>\>\]\>

#### Call Signature

> **step**\<`TName`, `TTask`\>(`name`, `task`, ...`resolver`): `WorkflowBuilder`\<`TPayload`, readonly \[`TPreviousResults`, [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)\<`TName`, [`TaskReferenceName`](/api/tasks-core/src/type-aliases/taskreferencename/)\<`TTask`\>, [`TaskReferenceResult`](/api/tasks-core/src/type-aliases/taskreferenceresult/)\<`TTask`\>\>\]\>

##### Type Parameters

###### TName

`TName` *extends* `string`

###### TTask

`TTask` *extends* [`TaskReference`](/api/tasks-core/src/type-aliases/taskreference/)

##### Parameters

###### name

`TName`

###### task

`TTask`

###### resolver

...`WorkflowStepResolverArguments`\<`TPayload`, `TPreviousResults`, `TTask`\>

##### Returns

`WorkflowBuilder`\<`TPayload`, readonly \[`TPreviousResults`, [`WorkflowStepResult`](/api/workflow-core/src/type-aliases/workflowstepresult/)\<`TName`, [`TaskReferenceName`](/api/tasks-core/src/type-aliases/taskreferencename/)\<`TTask`\>, [`TaskReferenceResult`](/api/tasks-core/src/type-aliases/taskreferenceresult/)\<`TTask`\>\>\]\>
