---
editUrl: false
next: false
prev: false
title: "RscServerEntry"
---

> **RscServerEntry** = `object`

## Properties

### actions?

> `readonly` `optional` **actions?**: `Readonly`\<`Record`\<`string`, [`RscServerAction`](/api/meta-vite/src/type-aliases/rscserveraction/)\>\>

---

### renderFlight

> `readonly` **renderFlight**: (`input`) => `ReadableStream`\<`Uint8Array`\>

#### Parameters

##### input

[`RscFlightRenderInput`](/api/meta-vite/src/type-aliases/rscflightrenderinput/)

#### Returns

`ReadableStream`\<`Uint8Array`\>

---

### routes

> `readonly` **routes**: readonly [`RscBuildRoute`](/api/meta-vite/src/type-aliases/rscbuildroute/)[]

---

### version

> `readonly` **version**: _typeof_ `RSC_SERVER_ENTRY_VERSION`
