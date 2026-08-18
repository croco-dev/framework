---
editUrl: false
next: false
prev: false
title: "RoutePathParamName"
---

> **RoutePathParamName**\<`Path`\> = `string` _extends_ `Path` ? `string` : `Path` _extends_ `` `${string}:${infer Token}/${infer Rest}` `` ? `NormalizePathParamToken`\<`Token`\> \| `RoutePathParamName`\<`` `/${Rest}` ``\> : `Path` _extends_ `` `${string}:${infer Token}` `` ? `NormalizePathParamToken`\<`Token`\> : `never`

## Type Parameters

### Path

`Path` _extends_ `string`
