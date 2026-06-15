---
editUrl: false
next: false
prev: false
title: "TxAdapter"
---

루트 트랜잭션과 savepoint 생성을 추상화하는 어댑터 계약입니다.

## Type Parameters

### TClient

`TClient`

### TOptions

`TOptions` = `unknown`

## Methods

### savepoint()

> **savepoint**\<`T`\>(`client`, `fn`, `options?`, `signal?`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### client

`TClient`

##### fn

(`client`) => `Promise`\<`T`\>

##### options?

`TOptions`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`T`\>

***

### supportsSavepoint()

> **supportsSavepoint**(): `boolean`

#### Returns

`boolean`

***

### transaction()

> **transaction**\<`T`\>(`fn`, `options?`, `signal?`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

(`client`) => `Promise`\<`T`\>

##### options?

`TOptions`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`T`\>
