---
editUrl: false
next: false
prev: false
title: "SagaStepContext"
---

> **SagaStepContext** = [`SagaStepIdempotencyContext`](/api/workflow-core/src/type-aliases/sagastepidempotencycontext/) & `object`

## Type Declaration

### attempt

> `readonly` **attempt**: `number`

### enqueueOutbox

> `readonly` **enqueueOutbox**: (`message`) => `void`

#### Parameters

##### message

[`SagaOutboxMessage`](/api/workflow-core/src/type-aliases/sagaoutboxmessage/)

#### Returns

`void`

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string`
