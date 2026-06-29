---
editUrl: false
next: false
prev: false
title: "SagaStore"
---

## Methods

### create()

> **create**(`params`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Parameters

##### params

[`CreateSagaExecutionParams`](/api/workflow-core/src/type-aliases/createsagaexecutionparams/)

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

***

### findById()

> **findById**(`id`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/) \| `null`\>

***

### findByIdempotencyKey()

> **findByIdempotencyKey**(`sagaName`, `key`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/) \| `null`\>

#### Parameters

##### sagaName

`string`

##### key

`string`

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/) \| `null`\>

***

### list()

> **list**(`options?`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)[]\>

#### Parameters

##### options?

[`ListSagaExecutionsOptions`](/api/workflow-core/src/type-aliases/listsagaexecutionsoptions/)

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)[]\>

***

### update()

> **update**(`id`, `data`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Parameters

##### id

`string`

##### data

`Partial`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>
