---
editUrl: false
next: false
prev: false
title: "Body"
---

## Call Signature

> **Body**\<`TContract`\>(`contract`): `ContractParameterDecorator`\<[`RouteHandlerBody`](/api/protocols-rest/src/type-aliases/routehandlerbody/)\<`TContract`\>\>

요청 본문 전체를 메서드 인자에 바인딩합니다.

### Type Parameters

#### TContract

`TContract` _extends_ [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `{ readonly body: z.ZodType }`

### Parameters

#### contract

`TContract`

### Returns

`ContractParameterDecorator`\<[`RouteHandlerBody`](/api/protocols-rest/src/type-aliases/routehandlerbody/)\<`TContract`\>\>

## Schema Overload

> **Body**(`schema?`): `ParameterDecorator`

요청 본문 전체를 메서드 인자에 바인딩합니다.

### Parameters

#### schema?

`ZodType`\<`any`, `ZodTypeDef`, `any`\>

### Returns

`ParameterDecorator`
