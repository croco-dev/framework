---
editUrl: false
next: false
prev: false
title: "validateRequest"
---

> **validateRequest**\<`T`\>(`schema`, `data`, `source`): `T`

요청 데이터를 Zod 스키마로 검증하고 실패 시 요청 검증 Problem을 발생시킵니다.

## Type Parameters

### T

`T`

## Parameters

### schema

`ZodType`\<`T`\>

### data

`unknown`

### source

`"headers"` | `"query"` | `"body"` | `"params"`

## Returns

`T`
