---
editUrl: false
next: false
prev: false
title: "createServerActionHandler"
---

> **createServerActionHandler**(`registry?`): `object`

Create a fetch handler that dispatches Server Actions via HTTP.
Integrates with composeHandler's apiRoutes dispatch:

- Base path: `/api/action`
- Extracts action name from URL pathname (e.g., `/api/action/signup` → `signup`)
- Method: POST only (Server Actions are write operations)
- Passes FormData to dispatchServerAction

Usage with composeHandler:

```ts
const handler = createMetaFetchHandler({
  apiRoutes: [createServerActionHandler()],
  pageHandler: renderServer,
});
```

## Parameters

### registry?

[`ServerActionRegistry`](/api/meta-vite/src/classes/serveractionregistry/) = `globalServerActionRegistry`

## Returns

`object`

### handler

> **handler**: (`request`, `context?`) => `Promise`\<`Response`\>

#### Parameters

##### request

`Request`

##### context?

[`RuntimeContext`](/api/meta-vite/src/type-aliases/runtimecontext/)

#### Returns

`Promise`\<`Response`\>

### method

> **method**: `"POST"`

### path

> **path**: `string`
