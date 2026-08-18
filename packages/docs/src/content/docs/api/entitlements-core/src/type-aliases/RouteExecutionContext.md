---
editUrl: false
next: false
prev: false
title: "RouteExecutionContext"
---

> **RouteExecutionContext** = `object`

## Methods

### getClass()

> **getClass**(): `unknown`

#### Returns

`unknown`

---

### getHandler()

> **getHandler**(): `string` \| `symbol`

#### Returns

`string` \| `symbol`

---

### getHttpContext()?

> `optional` **getHttpContext**(): \{ `req`: \{ `params`: `Record`\<`string`, `string`\>; \}; `get`: `T` \| `undefined`; `param`: `string` \| `undefined`; \} \| `null`

#### Returns

\{ `req`: \{ `params`: `Record`\<`string`, `string`\>; \}; `get`: `T` \| `undefined`; `param`: `string` \| `undefined`; \} \| `null`

---

### getRequest()

> **getRequest**(): `Request` & `object` & `object`

#### Returns

`Request` & `object` & `object`
