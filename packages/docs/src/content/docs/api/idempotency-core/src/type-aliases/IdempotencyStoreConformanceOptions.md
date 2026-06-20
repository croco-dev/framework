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

### createResponse()?

> `readonly` `optional` **createResponse**: () => `TResult`

#### Returns

`TResult`

***

### createStore()

> `readonly` **createStore**: () => [`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<`TResult`\> \| `Promise`\<[`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<`TResult`\>\>

#### Returns

[`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<`TResult`\> \| `Promise`\<[`IdempotencyStore`](/api/idempotency-core/src/type-aliases/idempotencystore/)\<`TResult`\>\>
