---
editUrl: false
next: false
prev: false
title: "ChunkExecutor"
---

## Constructors

### Constructor

> **new ChunkExecutor**(`executionManager`): `ChunkExecutor`

#### Parameters

##### executionManager

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)

#### Returns

`ChunkExecutor`

## Methods

### execute()

> **execute**\<`I`, `O`\>(`executionId`, `step`, `options?`): `Promise`\<`void`\>

#### Type Parameters

##### I

`I`

##### O

`O`

#### Parameters

##### executionId

`string`

##### step

[`Step`](/api/batch-core/src/classes/step/)\<`I`, `O`\>

##### options?

[`ChunkExecutorOptions`](/api/batch-core/src/type-aliases/chunkexecutoroptions/) = `{}`

#### Returns

`Promise`\<`void`\>

---

### saveCheckpoint()

> **saveCheckpoint**(`executionId`, `stepName`, `cursor`, `processedCount`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

Saves a step's cursor and cumulative input count in one checkpoint.

#### Parameters

##### executionId

`string`

##### stepName

`string`

##### cursor

`unknown`

##### processedCount

`number`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>
