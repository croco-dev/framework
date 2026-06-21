---
editUrl: false
next: false
prev: false
title: "IdempotencyFailedRecord"
---

> **IdempotencyFailedRecord** = [`IdempotencyRecordBase`](/api/idempotency-core/src/type-aliases/idempotencyrecordbase/) & `object`

## Type Declaration

### failedAt

> `readonly` **failedAt**: `Date`

### problem?

> `readonly` `optional` **problem**: `object`

#### problem.code

> `readonly` **code**: `string`

#### problem.detail?

> `readonly` `optional` **detail**: `string`

#### problem.status?

> `readonly` `optional` **status**: `number`

### retryable

> `readonly` **retryable**: `boolean`

### status

> `readonly` **status**: `"failed"`
