---
editUrl: false
next: false
prev: false
title: "routeParamSchema"
---

> **routeParamSchema**\<`TContract`, `Name`\>(`contract`, `name`): `ZodType`\<[`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\>\[`Name`\]\>

## Type Parameters

### TContract

`TContract` *extends* [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `{ readonly params: AnyZodObject }`

### Name

`Name` *extends* [`RoutePathParamName`](/api/protocols-rest/src/type-aliases/routepathparamname/)\<`TContract`\[`"path"`\]\> & keyof [`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\> & `string`

## Parameters

### contract

`TContract`

### name

`Name`

## Returns

`ZodType`\<[`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\>\[`Name`\]\>
