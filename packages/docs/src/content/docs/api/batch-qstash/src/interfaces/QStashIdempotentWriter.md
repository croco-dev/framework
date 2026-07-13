---
editUrl: false
next: false
prev: false
title: "QStashIdempotentWriter"
---

Writer capability required at the external side-effect boundary.

Implementations must treat processingToken as an idempotency key. The token is
stable when an expired continuation lease is reclaimed by another worker.

## Type Parameters

### O

`O`

## Methods

### writeIdempotent()

> **writeIdempotent**(`items`, `context`): `Promise`\<`void`\>

#### Parameters

##### items

`O`[]

##### context

[`QStashIdempotentWriteContext`](/api/batch-qstash/src/interfaces/qstashidempotentwritecontext/)

#### Returns

`Promise`\<`void`\>
