---
editUrl: false
next: false
prev: false
title: "QStashChunkExecutor"
---

Executes one fenced batch chunk and schedules its token-bound continuation.

## Constructors

### Constructor

> **new QStashChunkExecutor**(`executionManager`, `options`): `QStashChunkExecutor`

#### Parameters

##### executionManager

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/) & [`ExecutionContinuationManager`](/api/execution-core/src/interfaces/executioncontinuationmanager/)

##### options

[`QStashExecutorOptions`](/api/batch-qstash/src/interfaces/qstashexecutoroptions/)

#### Returns

`QStashChunkExecutor`

## Methods

### executeChunk()

> **executeChunk**\<`I`, `O`\>(`executionId`, `step`, `delivery?`): `Promise`\<[`QStashChunkResult`](/api/batch-qstash/src/type-aliases/qstashchunkresult/)\>

#### Type Parameters

##### I

`I`

##### O

`O`

#### Parameters

##### executionId

`string`

##### step

[`QStashStep`](/api/batch-qstash/src/type-aliases/qstashstep/)\<`I`, `O`\>

##### delivery?

[`QStashChunkDelivery`](/api/batch-qstash/src/interfaces/qstashchunkdelivery/) = `{}`

#### Returns

`Promise`\<[`QStashChunkResult`](/api/batch-qstash/src/type-aliases/qstashchunkresult/)\>
