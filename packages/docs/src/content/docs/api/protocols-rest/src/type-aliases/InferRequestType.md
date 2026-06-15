---
editUrl: false
next: false
prev: false
title: "InferRequestType"
---

> **InferRequestType**\<`T`\> = `object`

Zod 스키마 기반 요청/응답 타입 정의 서브-barrel입니다.

## Type Parameters

### T

`T` *extends* [`RequestSchema`](/api/protocols-rest/src/type-aliases/requestschema/)

## Properties

### body

> **body**: `T`\[`"body"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"body"`\]\> : `unknown`

***

### headers

> **headers**: `T`\[`"headers"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"headers"`\]\> : `unknown`

***

### params

> **params**: `T`\[`"params"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"params"`\]\> : `unknown`

***

### query

> **query**: `T`\[`"query"`\] *extends* `z.ZodType` ? `z.infer`\<`T`\[`"query"`\]\> : `unknown`
