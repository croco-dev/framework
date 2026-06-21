---
editUrl: false
next: false
prev: false
title: "IdempotencyCommitOptions"
---

> **IdempotencyCommitOptions**\<`TResult`\> = `object`

## Type Parameters

### TResult

`TResult`

## Properties

### key

> `readonly` **key**: [`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

***

### metadata?

> `readonly` `optional` **metadata**: `Record`\<`string`, `unknown`\>

***

### reservationId

> `readonly` **reservationId**: `string`

***

### response

> `readonly` **response**: `TResult`

***

### ttlMs?

> `readonly` `optional` **ttlMs**: `number`
