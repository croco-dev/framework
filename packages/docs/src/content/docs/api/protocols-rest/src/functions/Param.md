---
editUrl: false
next: false
prev: false
title: "Param"
---

## Contract Overload

> **Param**\<`TContract`, `Name`\>(`contract`, `name`): `ParameterDecorator`

경로 파라미터를 메서드 인자에 바인딩합니다.

### Type Parameters

#### TContract

`TContract` *extends* [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `{ readonly params: AnyZodObject }`

#### Name

`Name` *extends* [`RoutePathParamName`](/api/protocols-rest/src/type-aliases/routepathparamname/)\<`TContract`\[`"path"`\]\> & keyof [`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\> & `string`

### Parameters

#### contract

`TContract`

#### name

`Name`

### Returns

`ParameterDecorator`

## Schema Overload

> **Param**(`name`, `schema?`): `ParameterDecorator`

경로 파라미터를 메서드 인자에 바인딩합니다.

### Parameters

#### name

`string`

#### schema?

`ZodType`\<`any`, `ZodTypeDef`, `any`\>

### Returns

`ParameterDecorator`
