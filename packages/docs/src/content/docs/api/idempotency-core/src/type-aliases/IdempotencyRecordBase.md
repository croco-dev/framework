---
editUrl: false
next: false
prev: false
title: "IdempotencyRecordBase"
---

> **IdempotencyRecordBase** = [`DerivedIdempotencyKey`](/api/idempotency-core/src/type-aliases/derivedidempotencykey/) & `object`

## Type Declaration

### createdAt

> `readonly` **createdAt**: `Date`

### expiresAt

> `readonly` **expiresAt**: `Date` \| `null`

### metadata

> `readonly` **metadata**: `Record`\<`string`, `unknown`\>

### status

> `readonly` **status**: [`IdempotencyRecordStatus`](/api/idempotency-core/src/type-aliases/idempotencyrecordstatus/)

### updatedAt

> `readonly` **updatedAt**: `Date`
