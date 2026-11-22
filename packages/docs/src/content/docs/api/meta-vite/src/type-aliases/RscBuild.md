---
editUrl: false
next: false
prev: false
title: "RscBuild"
---

> **RscBuild** = `object`

A validated production build, loaded into a worker thread of its own. Each
build has its own module state, so builds of different apps can run in one
process without resolving each other's modules.

## Properties

### actions

> `readonly` **actions**: readonly `string`[]

Names of the actions the built `rsc` entry declares.

---

### clientDir

> `readonly` **clientDir**: `string`

Absolute path of the client build output (`<outDir>/client`).

---

### clientEntryUrl

> `readonly` **clientEntryUrl**: `string`

---

### clientManifestVersion

> `readonly` **clientManifestVersion**: `string`

---

### close

> `readonly` **close**: () => `Promise`\<`void`\>

Stops the worker; renders still in flight fail instead of hanging.

#### Returns

`Promise`\<`void`\>

---

### invokeAction

> `readonly` **invokeAction**: (`name`, `input`, `options`) => `Promise`\<`unknown`\>

#### Parameters

##### name

`string`

##### input

`unknown`

##### options

[`RscServerActionOptions`](/api/meta-vite/src/type-aliases/rscserveractionoptions/)

#### Returns

`Promise`\<`unknown`\>

---

### renderDocument

> `readonly` **renderDocument**: (`input`) => `Promise`\<[`RscDocumentRender`](/api/meta-vite/src/type-aliases/rscdocumentrender/)\>

Resolves once the document shell can render, so early failures can still set the status.

#### Parameters

##### input

[`RscRenderRequest`](/api/meta-vite/src/type-aliases/rscrenderrequest/)

#### Returns

`Promise`\<[`RscDocumentRender`](/api/meta-vite/src/type-aliases/rscdocumentrender/)\>

---

### renderFlight

> `readonly` **renderFlight**: (`input`) => `ReadableStream`\<`Uint8Array`\>

#### Parameters

##### input

[`RscRenderRequest`](/api/meta-vite/src/type-aliases/rscrenderrequest/)

#### Returns

`ReadableStream`\<`Uint8Array`\>

---

### routes

> `readonly` **routes**: readonly [`RenderRouteIR`](/api/meta-vite/src/type-aliases/renderrouteir/)[]

One `rsc`-mode route per route the built `rsc` entry declares.
