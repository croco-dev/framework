---
editUrl: false
next: false
prev: false
title: "TypedWorkflowOptions"
---

> **TypedWorkflowOptions**\<`TPayload`\> = `Omit`\<[`WorkflowOptions`](/api/workflow-core/src/type-aliases/workflowoptions/), `"steps"` \| `"idempotencyKey"` \| `"name"`\> & `object`

## Type Declaration

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string` \| [`WorkflowIdempotencyResolver`](/api/workflow-core/src/type-aliases/workflowidempotencyresolver/)\<`TPayload`\>

### name

> `readonly` **name**: `string`

## Type Parameters

### TPayload

`TPayload`
