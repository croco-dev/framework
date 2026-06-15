---
editUrl: false
next: false
prev: false
title: "RouteSchema"
---

> **RouteSchema**\<`Req`, `Res`\> = `object`

Zod 스키마 기반 요청/응답 타입 정의 서브-barrel입니다.

## Type Parameters

### Req

`Req` *extends* [`RequestSchema`](/api/protocols-rest/src/type-aliases/requestschema/) = [`RequestSchema`](/api/protocols-rest/src/type-aliases/requestschema/)

### Res

`Res` = `unknown`

## Properties

### request

> **request**: `Req`

***

### response

> **response**: [`ResponseSchemaType`](/api/protocols-rest/src/type-aliases/responseschematype/)\<`Res`\>
