---
editUrl: false
next: false
prev: false
title: "WorkflowOptions"
---

> **WorkflowOptions** = `object`

## Properties

### description?

> `readonly` `optional` **description?**: `string`

***

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string` \| [`WorkflowIdempotencyResolver`](/api/workflow-core/src/type-aliases/workflowidempotencyresolver/)

***

### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

***

### name?

> `readonly` `optional` **name?**: `string`

***

### steps

> `readonly` **steps**: readonly [`WorkflowTaskStepDeclaration`](/api/workflow-core/src/type-aliases/workflowtaskstepdeclaration/)[]

***

### timeout?

> `readonly` `optional` **timeout?**: `number`
