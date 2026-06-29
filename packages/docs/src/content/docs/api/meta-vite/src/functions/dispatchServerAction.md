---
editUrl: false
next: false
prev: false
title: "dispatchServerAction"
---

> **dispatchServerAction**(`name`, `formData`, `context?`, `registry?`): `Promise`\<`Response`\>

Dispatch a registered server action by name from the global registry by default.
- Validates input against the registered schema (if any)
- Returns 404 if action not found
- Returns 422 if validation fails
- Passes RuntimeContext to the handler

## Parameters

### name

`string`

### formData

`Record`\<`string`, `unknown`\> \| `FormData`

### context?

[`RuntimeContext`](/api/meta-vite/src/type-aliases/runtimecontext/)

### registry?

[`ServerActionRegistry`](/api/meta-vite/src/classes/serveractionregistry/) = `globalServerActionRegistry`

## Returns

`Promise`\<`Response`\>
