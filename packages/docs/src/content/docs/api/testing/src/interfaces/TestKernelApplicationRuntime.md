---
editUrl: false
next: false
prev: false
title: "TestKernelApplicationRuntime"
---

## Methods

### dispose()

> **dispose**(): `void` \| `Promise`\<`void`\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### run()

#### Call Signature

> **run**\<`T`\>(`fn`): `Promise`\<`T`\>

##### Type Parameters

###### T

`T`

##### Parameters

###### fn

() => `Promise`\<`T`\>

##### Returns

`Promise`\<`T`\>

#### Call Signature

> **run**\<`T`\>(`fn`): `T`

##### Type Parameters

###### T

`T`

##### Parameters

###### fn

() => `T`

##### Returns

`T`

***

### shutdown()?

> `optional` **shutdown**(): `void` \| `Promise`\<`void`\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### shutdownWithCleanup()?

> `optional` **shutdownWithCleanup**(`cleanup`): `void` \| `Promise`\<`void`\>

#### Parameters

##### cleanup

() => `void` \| `Promise`\<`void`\>

#### Returns

`void` \| `Promise`\<`void`\>
