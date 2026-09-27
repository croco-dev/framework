---
editUrl: false
next: false
prev: false
title: "IdempotencyStoreConformanceOptions"
---

> **IdempotencyStoreConformanceOptions**\<`TResult`\> = `object`

## Type Parameters

### TResult

`TResult` = `string`

## Properties

### createResponse?

> `readonly` `optional` **createResponse?**: () => `TResult`

#### Returns

`TResult`

---

### createStore

> `readonly` **createStore**: () => [`LeaseAwareIdempotencyStore`](/api/idempotency-core/src/type-aliases/leaseawareidempotencystore/)\<`TResult`\> \| `Promise`\<[`LeaseAwareIdempotencyStore`](/api/idempotency-core/src/type-aliases/leaseawareidempotencystore/)\<`TResult`\>\>

#### Returns

[`LeaseAwareIdempotencyStore`](/api/idempotency-core/src/type-aliases/leaseawareidempotencystore/)\<`TResult`\> \| `Promise`\<[`LeaseAwareIdempotencyStore`](/api/idempotency-core/src/type-aliases/leaseawareidempotencystore/)\<`TResult`\>\>
