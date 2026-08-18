---
editUrl: false
next: false
prev: false
title: "ExecutionInspectionManager"
---

Optional inspection capabilities for execution managers.

## Methods

### get()

> **get**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Get a single execution by ID.

This remains available here for compatibility and is also part of the primary manager contract.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

***

### list()

> **list**(`options?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

List executions for inspection and operations views.

#### Parameters

##### options?

[`ListExecutionsOptions`](/api/execution-core/src/interfaces/listexecutionsoptions/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

***

### recordLog()

> **recordLog**(`id`, `params`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Append a structured log entry to an execution.

#### Parameters

##### id

`string`

##### params

[`AddExecutionLogParams`](/api/execution-core/src/interfaces/addexecutionlogparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Throws

Error if execution not found
