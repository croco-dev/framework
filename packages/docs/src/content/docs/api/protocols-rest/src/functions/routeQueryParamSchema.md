---
editUrl: false
next: false
prev: false
title: "routeQueryParamSchema"
---

> **routeQueryParamSchema**\<`TContract`, `Name`\>(`contract`, `name`): `ZodType`\<[`RouteQuery`](/api/protocols-rest/src/type-aliases/routequery/)\<`TContract`\>\[`Name`\]\>

## Type Parameters

### TContract

`TContract` *extends* [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/) & `{ readonly query: AnyZodObject }`

### Name

`Name` *extends* keyof [`RouteQuery`](/api/protocols-rest/src/type-aliases/routequery/)\<`TContract`\> & `string`

## Parameters

### contract

`TContract`

### name

`Name`

## Returns

`ZodType`\<[`RouteQuery`](/api/protocols-rest/src/type-aliases/routequery/)\<`TContract`\>\[`Name`\]\>
