---
editUrl: false
next: false
prev: false
title: "defineRouteSchema"
---

> **defineRouteSchema**\<`Res`, `Req`\>(`schema`): [`DefinedRouteSchema`](/api/protocols-rest/src/type-aliases/definedrouteschema/)\<`Req`, `Res`\>

Zod 스키마 기반 요청/응답 타입 정의 서브-barrel입니다.

## Type Parameters

### Res

`Res` *extends* [`RouteSchemaLike`](/api/protocols-rest/src/type-aliases/routeschemalike/)\<`unknown`\>

### Req

`Req` *extends* [`RouteRequestSchemas`](/api/protocols-rest/src/type-aliases/routerequestschemas/) = \{ \}

## Parameters

### schema

#### request?

`Req`

#### response

`Res`

## Returns

[`DefinedRouteSchema`](/api/protocols-rest/src/type-aliases/definedrouteschema/)\<`Req`, `Res`\>
