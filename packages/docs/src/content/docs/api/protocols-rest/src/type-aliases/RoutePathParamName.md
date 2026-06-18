---
editUrl: false
next: false
prev: false
title: "RoutePathParamName"
---

> **RoutePathParamName**\<`Path`\> = `string` *extends* `Path` ? `string` : `Path` *extends* `` `${string}:${infer Token}/${infer Rest}` `` ? `NormalizePathParamToken`\<`Token`\> \| `RoutePathParamName`\<`` `/${Rest}` ``\> : `Path` *extends* `` `${string}:${infer Token}` `` ? `NormalizePathParamToken`\<`Token`\> : `never`

## Type Parameters

### Path

`Path` *extends* `string`
