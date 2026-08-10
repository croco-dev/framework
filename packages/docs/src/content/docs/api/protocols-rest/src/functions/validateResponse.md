---
editUrl: false
next: false
prev: false
title: "validateResponse"
---

> **validateResponse**\<`TSchema`\>(`schema`, `data`): `output`\<`TSchema`\>

응답 데이터를 Zod 스키마로 검증하고 실패 시 응답 검증 Problem을 발생시킵니다.

## Type Parameters

### TSchema

`TSchema` _extends_ `ZodType`\<`any`, `ZodTypeDef`, `any`\>

## Parameters

### schema

`TSchema`

### data

`unknown`

## Returns

`output`\<`TSchema`\>
