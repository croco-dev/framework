---
editUrl: false
next: false
prev: false
title: "InferRouteRequest"
---

> **InferRouteRequest**\<`T`\> = `object`

## Type Parameters

### T

`T` *extends* [`TypedRouteConfig`](/api/protocols-rest/src/type-aliases/typedrouteconfig/)

## Properties

### body

> **body**: `T`\[`"body"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"body"`\]\> : `unknown`

***

### params

> **params**: `T`\[`"params"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"params"`\]\> : `unknown`

***

### query

> **query**: `T`\[`"query"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"query"`\]\> : `unknown`
