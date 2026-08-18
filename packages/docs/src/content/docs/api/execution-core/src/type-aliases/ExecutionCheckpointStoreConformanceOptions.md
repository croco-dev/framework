---
editUrl: false
next: false
prev: false
title: "ExecutionCheckpointStoreConformanceOptions"
---

> **ExecutionCheckpointStoreConformanceOptions**\<`TStore`\> = `object`

## Type Parameters

### TStore

`TStore` _extends_ [`ExecutionStore`](/api/execution-core/src/classes/executionstore/)

## Properties

### createStore

> `readonly` **createStore**: () => `TStore` \| `Promise`\<`TStore`\>

#### Returns

`TStore` \| `Promise`\<`TStore`\>

---

### disposeStore?

> `readonly` `optional` **disposeStore?**: (`store`) => `Promise`\<`void`\> \| `void`

#### Parameters

##### store

`TStore`

#### Returns

`Promise`\<`void`\> \| `void`

---

### runConcurrentWrites

> `readonly` **runConcurrentWrites**: (`store`, `executionId`, `writes`) => `Promise`\<[`ExecutionCheckpointConcurrencyResult`](/api/execution-core/src/type-aliases/executioncheckpointconcurrencyresult/)\>

#### Parameters

##### store

`TStore`

##### executionId

`string`

##### writes

readonly [`ExecutionCheckpointWrite`](/api/execution-core/src/type-aliases/executioncheckpointwrite/)[]

#### Returns

`Promise`\<[`ExecutionCheckpointConcurrencyResult`](/api/execution-core/src/type-aliases/executioncheckpointconcurrencyresult/)\>
