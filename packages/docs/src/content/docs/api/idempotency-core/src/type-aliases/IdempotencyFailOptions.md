---
editUrl: false
next: false
prev: false
title: "IdempotencyFailOptions"
---

> **IdempotencyFailOptions** = `object`

## Properties

### key

> `readonly` **key**: [`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/)

---

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

---

### problem?

> `readonly` `optional` **problem?**: `object`

#### code

> `readonly` **code**: `string`

#### detail?

> `readonly` `optional` **detail?**: `string`

#### status?

> `readonly` `optional` **status?**: `number`

---

### reservationId

> `readonly` **reservationId**: `string`

---

### retryable?

> `readonly` `optional` **retryable?**: `boolean`

---

### ttlMs?

> `readonly` `optional` **ttlMs?**: `number`
