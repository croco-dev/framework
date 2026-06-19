---
editUrl: false
next: false
prev: false
title: "Query"
---

## Call Signature

> **Query**\<`TContract`, `Name`\>(`contract`, `name`): `ParameterDecorator`

쿼리스트링 값을 메서드 인자에 바인딩합니다.

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

> **Query**(`name`, `schema?`): `ParameterDecorator`

쿼리스트링 값을 메서드 인자에 바인딩합니다.

### Parameters

#### name

`string`

#### schema?

`ZodType`\<`any`, `ZodTypeDef`, `any`\>

### Returns

`ParameterDecorator`
