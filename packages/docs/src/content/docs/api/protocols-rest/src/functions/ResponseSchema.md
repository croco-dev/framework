---
editUrl: false
next: false
prev: false
title: "ResponseSchema"
---

## Contract Overload

> **ResponseSchema**\<`TContract`\>(`contract`): `MethodDecorator`

응답 스키마를 메서드에 바인딩합니다.

### Type Parameters

#### TContract

`TContract` *extends* [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `{ readonly response: z.ZodType }`

### Parameters

#### contract

`TContract`

### Returns

`MethodDecorator`

## Schema Overload

> **ResponseSchema**(`schema`): `MethodDecorator`

응답 스키마를 메서드에 바인딩합니다.

### Parameters

#### schema

`ZodType`

### Returns

`MethodDecorator`
