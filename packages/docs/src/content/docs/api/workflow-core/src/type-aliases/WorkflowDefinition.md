---
editUrl: false
next: false
prev: false
title: "WorkflowDefinition"
---

> **WorkflowDefinition** = `object`

## Properties

### description?

> `readonly` `optional` **description?**: `string`

---

### methodName

> `readonly` **methodName**: `string`

---

### name

> `readonly` **name**: `string`

---

### options

> `readonly` **options**: `object`

#### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string` \| [`WorkflowIdempotencyResolver`](/api/workflow-core/src/type-aliases/workflowidempotencyresolver/)

#### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

#### timeout?

> `readonly` `optional` **timeout?**: `number`

---

### steps

> `readonly` **steps**: readonly [`WorkflowTaskStep`](/api/workflow-core/src/type-aliases/workflowtaskstep/)[]

---

### target

> `readonly` **target**: `object`

---

### triggers

> `readonly` **triggers**: readonly [`AnyTriggerMetadata`](/api/triggers-core/src/type-aliases/anytriggermetadata/)[]
