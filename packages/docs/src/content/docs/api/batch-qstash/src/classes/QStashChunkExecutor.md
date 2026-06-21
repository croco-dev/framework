---
editUrl: false
next: false
prev: false
title: "QStashChunkExecutor"
---

배치 Step을 청크 단위로 실행하고 다음 청크를 QStash로 예약하는 실행기입니다.

## Constructors

### Constructor

> **new QStashChunkExecutor**(`executionManager`, `options`): `QStashChunkExecutor`

#### Parameters

##### executionManager

`ExecutionManager`

##### options

[`QStashExecutorOptions`](/api/batch-qstash/src/interfaces/qstashexecutoroptions/)

#### Returns

`QStashChunkExecutor`

## Methods

### executeChunk()

> **executeChunk**\<`I`, `O`\>(`executionId`, `step`): `Promise`\<\{ `hasMore`: `boolean`; `processedCount`: `number`; \}\>

#### Type Parameters

##### I

`I`

##### O

`O`

#### Parameters

##### executionId

`string`

##### step

`Step`\<`I`, `O`\>

#### Returns

`Promise`\<\{ `hasMore`: `boolean`; `processedCount`: `number`; \}\>
