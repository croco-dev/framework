---
editUrl: false
next: false
prev: false
title: "validateRequest"
---

> **validateRequest**\<`TSchema`\>(`schema`, `data`, `source`): `output`\<`TSchema`\>

요청 데이터를 Zod 스키마로 검증하고 실패 시 요청 검증 Problem을 발생시킵니다.

## Type Parameters

### TSchema

`TSchema` _extends_ `ZodType`\<`any`, `ZodTypeDef`, `any`\>

## Parameters

### schema

`TSchema`

### data

`unknown`

### source

`"query"` \| `"headers"` \| `"body"` \| `"params"`

## Returns

`output`\<`TSchema`\>
