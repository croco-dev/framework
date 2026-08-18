---
editUrl: false
next: false
prev: false
title: "MetaFetchHandlerOptions"
---

> **MetaFetchHandlerOptions** = `object`

## Properties

### apiHandler?

> `readonly` `optional` **apiHandler?**: (`request`, `context?`) => `Promise`\<[`CrocoApiHandlerResult`](/api/meta-vite/src/type-aliases/crocoapihandlerresult/)\>

#### Parameters

##### request

`Request`

##### context?

[`RuntimeContext`](/api/meta-vite/src/type-aliases/runtimecontext/)

#### Returns

`Promise`\<[`CrocoApiHandlerResult`](/api/meta-vite/src/type-aliases/crocoapihandlerresult/)\>

---

### apiRoutes?

> `readonly` `optional` **apiRoutes?**: readonly [`ApiRouteIR`](/api/meta-vite/src/type-aliases/apirouteir/)[]

---

### pageHandler?

> `readonly` `optional` **pageHandler?**: [`RenderServer`](/api/meta-vite/src/classes/renderserver/) \| [`CrocoFetchHandler`](/api/meta-vite/src/type-aliases/crocofetchhandler/)
