---
editUrl: false
next: false
prev: false
title: "routeParamSchema"
---

> **routeParamSchema**\<`TContract`, `Name`\>(`contract`, `name`): `ZodType`\<[`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\>\[`Name`\]\>

## Type Parameters

### TContract

`TContract` *extends* [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/)\<[`HttpMethod`](/api/protocols-rest/src/enumerations/httpmethod/), `string`, `AnyZodObject` \| `undefined`, `AnyZodObject` \| `undefined`, `ZodType`\<`any`, `ZodTypeDef`, `any`\> \| `undefined`, `ZodType`\<`any`, `ZodTypeDef`, `any`\> \| `undefined`, readonly [`ProblemConstructor`](/api/protocols-rest/src/type-aliases/problemconstructor/)\<[`Problem`](/api/problems-core/src/classes/problem/)\>[] \| `undefined`\> & `object`

### Name

`Name` *extends* `string`

## Parameters

### contract

`TContract`

### name

`Name`

## Returns

`ZodType`\<[`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\>\[`Name`\]\>
