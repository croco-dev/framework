---
editUrl: false
next: false
prev: false
title: "IdempotencyStore"
---

> **IdempotencyStore**\<`TResult`\> = `object`

## Type Parameters

### TResult

`TResult` = `unknown`

## Methods

### commit()

> **commit**(`options`): `Promise`\<[`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\>\>

#### Parameters

##### options

[`IdempotencyCommitOptions`](/api/idempotency-core/src/type-aliases/idempotencycommitoptions/)\<`TResult`\>

#### Returns

`Promise`\<[`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\>\>

***

### expire()

> **expire**(`options`): `Promise`\<`boolean`\>

#### Parameters

##### options

[`IdempotencyExpireOptions`](/api/idempotency-core/src/type-aliases/idempotencyexpireoptions/)

#### Returns

`Promise`\<`boolean`\>

***

### fail()

> **fail**(`options`): `Promise`\<[`IdempotencyFailedRecord`](/api/idempotency-core/src/type-aliases/idempotencyfailedrecord/)\>

#### Parameters

##### options

[`IdempotencyFailOptions`](/api/idempotency-core/src/type-aliases/idempotencyfailoptions/)

#### Returns

`Promise`\<[`IdempotencyFailedRecord`](/api/idempotency-core/src/type-aliases/idempotencyfailedrecord/)\>

***

### replay()

> **replay**(`key`): `Promise`\<[`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\> \| `null`\>

#### Parameters

##### key

[`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

#### Returns

`Promise`\<[`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\> \| `null`\>

***

### reserve()

> **reserve**(`key`, `options?`): `Promise`\<[`IdempotencyReserveResult`](/api/idempotency-core/src/type-aliases/idempotencyreserveresult/)\<`TResult`\>\>

#### Parameters

##### key

[`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

##### options?

[`IdempotencyReserveOptions`](/api/idempotency-core/src/type-aliases/idempotencyreserveoptions/)

#### Returns

`Promise`\<[`IdempotencyReserveResult`](/api/idempotency-core/src/type-aliases/idempotencyreserveresult/)\<`TResult`\>\>
