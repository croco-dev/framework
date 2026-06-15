---
editUrl: false
next: false
prev: false
title: "EndpointRequest"
---

> **EndpointRequest**\<`T`\> = `object`

## Type Parameters

### T

`T` *extends* [`ApiEndpoint`](/api/protocols-rest/src/type-aliases/apiendpoint/)

## Properties

### body

> **body**: `T`\[`"body"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"body"`\]\> : `undefined`

***

### params

> **params**: `T`\[`"params"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"params"`\]\> : `undefined`

***

### query

> **query**: `T`\[`"query"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"query"`\]\> : `undefined`
