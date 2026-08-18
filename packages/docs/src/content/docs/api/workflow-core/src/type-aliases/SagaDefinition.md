---
editUrl: false
next: false
prev: false
title: "SagaDefinition"
---

> **SagaDefinition** = `object`

## Properties

### description?

> `readonly` `optional` **description?**: `string`

---

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string` \| [`SagaIdempotencyResolver`](/api/workflow-core/src/type-aliases/sagaidempotencyresolver/)

---

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

---

### name

> `readonly` **name**: `string`

---

### outbox?

> `readonly` `optional` **outbox?**: [`SagaOutboxPublisher`](/api/workflow-core/src/type-aliases/sagaoutboxpublisher/)

---

### steps

> `readonly` **steps**: readonly [`SagaStepDefinition`](/api/workflow-core/src/type-aliases/sagastepdefinition/)[]
