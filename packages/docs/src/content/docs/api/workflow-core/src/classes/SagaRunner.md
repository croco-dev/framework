---
editUrl: false
next: false
prev: false
title: "SagaRunner"
---

## Constructors

### Constructor

> **new SagaRunner**(`store?`): `SagaRunner`

#### Parameters

##### store?

[`SagaStore`](/api/workflow-core/src/interfaces/sagastore/) = `...`

#### Returns

`SagaRunner`

## Methods

### execute()

> **execute**(`definition`, `payload`): `Promise`\<[`SagaRunResult`](/api/workflow-core/src/type-aliases/sagarunresult/)\>

#### Parameters

##### definition

[`SagaDefinition`](/api/workflow-core/src/type-aliases/sagadefinition/)

##### payload

`unknown`

#### Returns

`Promise`\<[`SagaRunResult`](/api/workflow-core/src/type-aliases/sagarunresult/)\>

***

### getExecution()

> **getExecution**(`executionId`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

#### Parameters

##### executionId

`string`

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)\>

***

### listExecutions()

> **listExecutions**(`options?`): `Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)[]\>

#### Parameters

##### options?

[`ListSagaExecutionsOptions`](/api/workflow-core/src/type-aliases/listsagaexecutionsoptions/)

#### Returns

`Promise`\<[`SagaExecution`](/api/workflow-core/src/type-aliases/sagaexecution/)[]\>

***

### replay()

> **replay**(`definition`, `executionId`, `params?`): `Promise`\<[`SagaRunResult`](/api/workflow-core/src/type-aliases/sagarunresult/)\>

#### Parameters

##### definition

[`SagaDefinition`](/api/workflow-core/src/type-aliases/sagadefinition/)

##### executionId

`string`

##### params?

[`ReplaySagaParams`](/api/workflow-core/src/type-aliases/replaysagaparams/) = `{}`

#### Returns

`Promise`\<[`SagaRunResult`](/api/workflow-core/src/type-aliases/sagarunresult/)\>
