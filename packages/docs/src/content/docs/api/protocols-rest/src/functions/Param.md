---
editUrl: false
next: false
prev: false
title: "Param"
---

## Call Signature

> **Param**\<`TContract`, `Name`\>(`contract`, `name`): `ParameterDecorator`

경로 파라미터를 메서드 인자에 바인딩합니다.

### Type Parameters

#### TContract

`TContract` *extends* [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `object`

#### Name

`Name` *extends* `string`

### Parameters

#### contract

`TContract`

#### name

`Name`

### Returns

`ParameterDecorator`

## Call Signature

> **Param**(`name`, `schema?`): `ParameterDecorator`

경로 파라미터를 메서드 인자에 바인딩합니다.

### Parameters

#### name

`string`

#### schema?

`ZodType`\<`any`, `ZodTypeDef`, `any`\>

### Returns

`ParameterDecorator`
