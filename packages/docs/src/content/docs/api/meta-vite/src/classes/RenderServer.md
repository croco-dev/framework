---
editUrl: false
next: false
prev: false
title: "RenderServer"
---

## Constructors

### Constructor

> **new RenderServer**(`routes`, `rscOptions?`): `RenderServer`

#### Parameters

##### routes

[`RenderRouteIR`](/api/meta-vite/src/type-aliases/renderrouteir/)[]

##### rscOptions?

[`RscRenderOptions`](/api/meta-vite/src/type-aliases/rscrenderoptions/) = `{}`

#### Returns

`RenderServer`

## Methods

### handle()

> **handle**(`request`, `context?`): `Promise`\<`Response`\>

#### Parameters

##### request

`Request`

##### context?

[`RuntimeContext`](/api/meta-vite/src/type-aliases/runtimecontext/)

#### Returns

`Promise`\<`Response`\>
