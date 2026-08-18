---
editUrl: false
next: false
prev: false
title: "InMemorySagaStore"
---

## Implements

- [`SagaStore`](/api/workflow-core/src/interfaces/sagastore/)

## Constructors

### Constructor

> **new InMemorySagaStore**(): `InMemorySagaStore`

#### Returns

`InMemorySagaStore`

## Methods

### create()

> **create**(`params`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Parameters

##### params

[`CreateSagaExecutionParams`](/api/workflow-core/src/type-aliases/createsagaexecutionparams/)

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Implementation of

[`SagaStore`](/api/workflow-core/src/interfaces/sagastore/).[`create`](/api/workflow-core/src/interfaces/sagastore/#create)

---

### findById()

> **findById**(`id`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/) \| `null`\>

#### Implementation of

[`SagaStore`](/api/workflow-core/src/interfaces/sagastore/).[`findById`](/api/workflow-core/src/interfaces/sagastore/#findbyid)

---

### findByIdempotencyKey()

> **findByIdempotencyKey**(`sagaName`, `key`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/) \| `null`\>

#### Parameters

##### sagaName

`string`

##### key

`string`

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/) \| `null`\>

#### Implementation of

[`SagaStore`](/api/workflow-core/src/interfaces/sagastore/).[`findByIdempotencyKey`](/api/workflow-core/src/interfaces/sagastore/#findbyidempotencykey)

---

### list()

> **list**(`options?`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)[]\>

#### Parameters

##### options?

[`ListSagaExecutionsOptions`](/api/workflow-core/src/type-aliases/listsagaexecutionsoptions/) = `{}`

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)[]\>

#### Implementation of

[`SagaStore`](/api/workflow-core/src/interfaces/sagastore/).[`list`](/api/workflow-core/src/interfaces/sagastore/#list)

---

### update()

> **update**(`id`, `data`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Parameters

##### id

`string`

##### data

`Partial`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Implementation of

[`SagaStore`](/api/workflow-core/src/interfaces/sagastore/).[`update`](/api/workflow-core/src/interfaces/sagastore/#update)
