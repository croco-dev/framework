---
editUrl: false
next: false
prev: false
title: "createCrocoSpaViteConfig"
---

> **createCrocoSpaViteConfig**(`options?`): `object`

Creates the minimal Vite config fragment used by Croco SPA templates.

The returned object keeps build output, base path, and environment variable
prefix explicit so generated apps can share the same runtime contract in
local preview, CI smoke tests, and deployment recipes.

## Parameters

### options?

[`CrocoSpaOptions`](/api/frontend-vite/src/type-aliases/crocospaoptions/) = `{}`

## Returns

`object`

### base

> **base**: `string`

### build

> **build**: `object`

#### build.outDir

> **outDir**: `string`

### envPrefix

> **envPrefix**: `string`[]

### plugins

> **plugins**: `Plugin`\<`any`\>[]
