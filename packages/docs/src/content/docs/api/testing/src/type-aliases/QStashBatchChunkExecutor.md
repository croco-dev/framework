---
editUrl: false
next: false
prev: false
title: "QStashBatchChunkExecutor"
---

> **QStashBatchChunkExecutor** = `object`

## Methods

### executeChunk()

> **executeChunk**(`executionId`, `step`, `delivery?`): `Promise`\<\{ `hasMore`: `boolean`; `processedCount`: `number`; \} \| \{ `deliveryToken`: `string`; `hasMore`: `false`; `kind`: `"stale"`; `processedCount`: `0`; \}\>

#### Parameters

##### executionId

`string`

##### step

[`QStashBatchStep`](/api/testing/src/type-aliases/qstashbatchstep/)

##### delivery?

###### continuationToken?

`string`

###### workerId?

`string`

#### Returns

`Promise`\<\{ `hasMore`: `boolean`; `processedCount`: `number`; \} \| \{ `deliveryToken`: `string`; `hasMore`: `false`; `kind`: `"stale"`; `processedCount`: `0`; \}\>
