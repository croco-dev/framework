---
editUrl: false
next: false
prev: false
title: "SagaStepDefinition"
---

> **SagaStepDefinition**\<`TInput`, `TOutput`\> = `object`

## Type Parameters

### TInput

`TInput` = `unknown`

### TOutput

`TOutput` = `unknown`

## Properties

### compensate?

> `readonly` `optional` **compensate?**: [`SagaCompensationHandler`](/api/workflow-core/src/type-aliases/sagacompensationhandler/)\<`TInput`\>

---

### id

> `readonly` **id**: `string`

---

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string` \| [`SagaStepIdempotencyResolver`](/api/workflow-core/src/type-aliases/sagastepidempotencyresolver/)

---

### input?

> `readonly` `optional` **input?**: [`SagaStepInputResolver`](/api/workflow-core/src/type-aliases/sagastepinputresolver/)

---

### retry?

> `readonly` `optional` **retry?**: [`SagaRetryPolicy`](/api/workflow-core/src/type-aliases/sagaretrypolicy/)

---

### run

> `readonly` **run**: [`SagaStepHandler`](/api/workflow-core/src/type-aliases/sagastephandler/)\<`TInput`, `TOutput`\>
