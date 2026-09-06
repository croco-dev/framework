---
editUrl: false
next: false
prev: false
title: "TaskDispatcher"
---

Provider-neutral contract for dispatching a task to an external execution service.

## Methods

### execute()

> **execute**(`taskId`, `payload`, `options?`): `Promise`\<[`TaskDispatchResult`](/api/tasks-core/src/type-aliases/taskdispatchresult/)\>

#### Parameters

##### taskId

`string`

##### payload

`unknown`

##### options?

[`TaskDispatchOptions`](/api/tasks-core/src/type-aliases/taskdispatchoptions/)

#### Returns

`Promise`\<[`TaskDispatchResult`](/api/tasks-core/src/type-aliases/taskdispatchresult/)\>
