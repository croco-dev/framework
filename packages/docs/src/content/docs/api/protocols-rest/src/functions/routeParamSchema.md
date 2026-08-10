---
editUrl: false
next: false
prev: false
title: "routeParamSchema"
---

> **routeParamSchema**\<`TContract`, `Name`\>(`contract`, `name`): `TContract`\[`"params"`\]\[`"shape"`\]\[`Name`\]

## Type Parameters

### TContract

`TContract` _extends_ [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `{ readonly params: AnyZodObject }`

### Name

`Name` _extends_ [`RoutePathParamName`](/api/protocols-rest/src/type-aliases/routepathparamname/)\<`TContract`\[`"path"`\]\> & keyof [`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)\<`TContract`\> & `string`

## Parameters

### contract

`TContract`

### name

`Name`

## Returns

`TContract`\[`"params"`\]\[`"shape"`\]\[`Name`\]
