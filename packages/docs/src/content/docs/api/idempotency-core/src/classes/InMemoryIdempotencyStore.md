---
editUrl: false
next: false
prev: false
title: "InMemoryIdempotencyStore"
---

## Type Parameters

### TResult

`TResult` = `unknown`

## Implements

- [`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<`TResult`\>

## Constructors

### Constructor

> **new InMemoryIdempotencyStore**\<`TResult`\>(`options?`): `InMemoryIdempotencyStore`\<`TResult`\>

#### Parameters

##### options?

[`InMemoryIdempotencyStoreOptions`](/api/idempotency-core/src/type-aliases/inmemoryidempotencystoreoptions/) = `{}`

#### Returns

`InMemoryIdempotencyStore`\<`TResult`\>

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

##### Returns

`number`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

---

### commit()

> **commit**(`options`): `Promise`\<[`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\>\>

#### Parameters

##### options

[`IdempotencyCommitOptions`](/api/idempotency-core/src/type-aliases/idempotencycommitoptions/)\<`TResult`\>

#### Returns

`Promise`\<[`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\>\>

#### Implementation of

`IdempotencyStore.commit`

---

### expire()

> **expire**(`options`): `Promise`\<`boolean`\>

#### Parameters

##### options

[`IdempotencyExpireOptions`](/api/idempotency-core/src/type-aliases/idempotencyexpireoptions/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`IdempotencyStore.expire`

---

### fail()

> **fail**(`options`): `Promise`\<[`IdempotencyFailedRecord`](/api/idempotency-core/src/type-aliases/idempotencyfailedrecord/)\>

#### Parameters

##### options

[`IdempotencyFailOptions`](/api/idempotency-core/src/type-aliases/idempotencyfailoptions/)

#### Returns

`Promise`\<[`IdempotencyFailedRecord`](/api/idempotency-core/src/type-aliases/idempotencyfailedrecord/)\>

#### Implementation of

`IdempotencyStore.fail`

---

### replay()

> **replay**(`key`): `Promise`\<[`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\> \| `null`\>

#### Parameters

##### key

[`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

#### Returns

`Promise`\<[`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\> \| `null`\>

#### Implementation of

`IdempotencyStore.replay`

---

### reserve()

> **reserve**(`key`, `options?`): `Promise`\<[`IdempotencyReserveResult`](/api/idempotency-core/src/type-aliases/idempotencyreserveresult/)\<`TResult`\>\>

#### Parameters

##### key

[`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

##### options?

[`IdempotencyReserveOptions`](/api/idempotency-core/src/type-aliases/idempotencyreserveoptions/) = `{}`

#### Returns

`Promise`\<[`IdempotencyReserveResult`](/api/idempotency-core/src/type-aliases/idempotencyreserveresult/)\<`TResult`\>\>

#### Implementation of

`IdempotencyStore.reserve`
