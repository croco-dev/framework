---
editUrl: false
next: false
prev: false
title: "createServerAction"
---

> **createServerAction**\<`TInput`, `TOutput`, `TProblemCode`\>(`config`, `registry?`): `void`

Register a server action in the global registry by default.

## Type Parameters

### TInput

`TInput`

### TOutput

`TOutput` = `unknown`

### TProblemCode

`TProblemCode` _extends_ `string` = `string`

## Parameters

### config

[`ServerActionConfig`](/api/meta-vite/src/type-aliases/serveractionconfig/)\<`TInput`, `TOutput`, `TProblemCode`\>

### registry?

[`ServerActionRegistry`](/api/meta-vite/src/classes/serveractionregistry/) = `globalServerActionRegistry`

## Returns

`void`

## Throws

Error if action name is already registered in the selected registry
