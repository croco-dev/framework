---
editUrl: false
next: false
prev: false
title: "createNodeHandler"
---

> **createNodeHandler**(`handler`): `object`

Node.js HTTP server adapter.
Wraps a CrocoFetchHandler for `@hono/node-server`-compatible `serve({ fetch })`.

## Parameters

### handler

[`CrocoFetchHandler`](/api/meta-vite/src/type-aliases/crocofetchhandler/)

## Returns

`object`

### fetch

> **fetch**: (`request`) => `Promise`\<`Response`\>

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>
