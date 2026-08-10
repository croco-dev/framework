---
editUrl: false
next: false
prev: false
title: "routeQueryParamSchema"
---

> **routeQueryParamSchema**\<`TContract`, `Name`\>(`contract`, `name`): `TContract`\[`"query"`\]\[`"shape"`\]\[`Name`\]

## Type Parameters

### TContract

`TContract` _extends_ [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `{ readonly query: AnyZodObject }`

### Name

`Name` _extends_ keyof [`RouteQuery`](/api/protocols-rest/src/type-aliases/routequery/)\<`TContract`\> & `string`

## Parameters

### contract

`TContract`

### name

`Name`

## Returns

`TContract`\[`"query"`\]\[`"shape"`\]\[`Name`\]
