---
editUrl: false
next: false
prev: false
title: "InferRequestType"
---

> **InferRequestType**\<`T`\> = `object`

## Type Parameters

### T

`T` _extends_ [`RequestSchema`](/api/protocols-rest/src/type-aliases/requestschema/)

## Properties

### body

> **body**: `T`\[`"body"`\] _extends_ `z.ZodType` ? `z.infer`\<`T`\[`"body"`\]\> : `unknown`

---

### headers

> **headers**: `T`\[`"headers"`\] _extends_ `z.ZodType` ? `z.infer`\<`T`\[`"headers"`\]\> : `unknown`

---

### params

> **params**: `T`\[`"params"`\] _extends_ `z.ZodType` ? `z.infer`\<`T`\[`"params"`\]\> : `unknown`

---

### query

> **query**: `T`\[`"query"`\] _extends_ `z.ZodType` ? `z.infer`\<`T`\[`"query"`\]\> : `unknown`
