---
editUrl: false
next: false
prev: false
title: "QStashBatchStep"
---

> **QStashBatchStep** = `object`

## Properties

### chunkSize

> `readonly` **chunkSize**: `number`

***

### classifyFailure?

> `readonly` `optional` **classifyFailure?**: (`error`, `context`) => `boolean` \| \{ `code?`: `string`; `retryable`: `boolean`; \}

#### Parameters

##### error

`unknown`

##### context

###### executionId

`string`

###### stepName

`string`

#### Returns

`boolean` \| \{ `code?`: `string`; `retryable`: `boolean`; \}

***

### name

> `readonly` **name**: `string`

***

### processor?

> `readonly` `optional` **processor?**: `object`

#### process()

> **process**(`item`): `unknown`

##### Parameters

###### item

`unknown`

##### Returns

`unknown`

***

### reader

> `readonly` **reader**: `object`

#### getCheckpoint()?

> `optional` **getCheckpoint**(): `unknown`

##### Returns

`unknown`

#### peek()?

> `optional` **peek**(): `Promise`\<`unknown`\>

##### Returns

`Promise`\<`unknown`\>

#### read()

> **read**(): `Promise`\<`unknown`\>

##### Returns

`Promise`\<`unknown`\>

#### restoreCheckpoint()?

> `optional` **restoreCheckpoint**(`checkpoint`): `void`

##### Parameters

###### checkpoint

`unknown`

##### Returns

`void`

***

### writer

> `readonly` **writer**: `object`

#### write()

> **write**(`items`): `void` \| `Promise`\<`void`\>

##### Parameters

###### items

`unknown`[]

##### Returns

`void` \| `Promise`\<`void`\>

#### writeIdempotent()

> **writeIdempotent**(`items`, `context`): `Promise`\<`void`\>

##### Parameters

###### items

`unknown`[]

###### context

###### attempt

`number`

###### executionId

`string`

###### processingToken

`string`

###### stepName

`string`

##### Returns

`Promise`\<`void`\>
