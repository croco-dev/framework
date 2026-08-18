---
editUrl: false
next: false
prev: false
title: "ServerActionRegistry"
---

## Constructors

### Constructor

> **new ServerActionRegistry**(): `ServerActionRegistry`

#### Returns

`ServerActionRegistry`

## Methods

### clear()

> **clear**(): `void`

Clear all server actions from this registry.

#### Returns

`void`

---

### dispatch()

> **dispatch**(`name`, `formData`, `context?`): `Promise`\<`Response`\>

Dispatch a registered server action by name.

- Validates input against the registered schema (if any)
- Returns 404 if action not found
- Returns 422 if validation fails
- Passes RuntimeContext to the handler

#### Parameters

##### name

`string`

##### formData

`Record`\<`string`, `unknown`\> \| `FormData`

##### context?

[`RuntimeContext`](/api/meta-vite/src/type-aliases/runtimecontext/)

#### Returns

`Promise`\<`Response`\>

---

### getActions()

> **getActions**(): [`ServerActionContractIR`](/api/meta-vite/src/type-aliases/serveractioncontractir/)[]

#### Returns

[`ServerActionContractIR`](/api/meta-vite/src/type-aliases/serveractioncontractir/)[]

---

### register()

> **register**\<`TInput`, `TOutput`, `TProblemCode`\>(`config`): `void`

Register a server action in this registry.

#### Type Parameters

##### TInput

`TInput`

##### TOutput

`TOutput`

##### TProblemCode

`TProblemCode` _extends_ `string`

#### Parameters

##### config

[`ServerActionConfig`](/api/meta-vite/src/type-aliases/serveractionconfig/)\<`TInput`, `TOutput`, `TProblemCode`\>

#### Returns

`void`

#### Throws

Error if action name is already registered in this registry

---

### unregister()

> **unregister**(`name`): `boolean`

Remove a registered server action from this registry.

#### Parameters

##### name

`string`

#### Returns

`boolean`
