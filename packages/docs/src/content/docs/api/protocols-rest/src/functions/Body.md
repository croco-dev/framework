---
editUrl: false
next: false
prev: false
title: "Body"
---

## Call Signature

> **Body**\<`TContract`\>(`contract`): `ParameterDecorator`

요청 본문 전체를 메서드 인자에 바인딩합니다.

### Type Parameters

#### TContract

`TContract` *extends* [`RouteContractWithBody`](/api/protocols-rest/src/type-aliases/routecontractwithbody/)

### Parameters

#### contract

`TContract`

### Returns

`ParameterDecorator`

## Call Signature

> **Body**(`schema?`): `ParameterDecorator`

요청 본문 전체를 메서드 인자에 바인딩합니다.

### Parameters

#### schema?

`ZodType`\<`any`, `ZodTypeDef`, `any`\>

### Returns

`ParameterDecorator`
