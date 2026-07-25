---
editUrl: false
next: false
prev: false
title: "Param"
---

## Call Signature

> **Param**\<`TContract`, `Name`\>(`contract`, `name`): `ContractParameterDecorator`\<[`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\>\[`Name`\]\>

경로 파라미터를 메서드 인자에 바인딩합니다.

### Type Parameters

#### TContract

`TContract` _extends_ [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `{ readonly params: AnyZodObject }`

#### Name

`Name` _extends_ [`RoutePathParamName`](/api/protocols-rest/src/type-aliases/routepathparamname/)\<`TContract`\[`"path"`\]\> & keyof [`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\> & `string`

### Parameters

#### contract

`TContract`

#### name

`Name`

### Returns

`ContractParameterDecorator`\<[`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\>\[`Name`\]\>

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
