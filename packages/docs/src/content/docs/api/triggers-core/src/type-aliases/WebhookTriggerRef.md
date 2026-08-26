---
editUrl: false
next: false
prev: false
title: "WebhookTriggerRef"
---

> **WebhookTriggerRef**\<`Request`, `Result`, `Path`, `Method`\> = `TriggerHandlerContract`\<`Request`, `Result`\> & `object`

## Type Declaration

### method

> `readonly` **method**: `Method`

### path

> `readonly` **path**: `Path`

### type

> `readonly` **type**: `"webhook"`

## Type Parameters

### Request

`Request` = `unknown`

### Result

`Result` = `void`

### Path

`Path` _extends_ `string` = `string`

### Method

`Method` _extends_ [`WebhookHttpMethod`](/api/triggers-core/src/type-aliases/webhookhttpmethod/) = [`WebhookHttpMethod`](/api/triggers-core/src/type-aliases/webhookhttpmethod/)
