---
editUrl: false
next: false
prev: false
title: "RuntimeContext"
---

## Properties

### capabilities

> **capabilities**: [`RuntimeCapabilities`](/api/framework-context/src/type-aliases/runtimecapabilities/)

---

### env?

> `optional` **env?**: `Record`\<`string`, `unknown`\>

---

### logger?

> `optional` **logger?**: [`ILogger`](/api/framework-context/src/interfaces/ilogger/)

---

### native?

> `optional` **native?**: [`RuntimeNativeContext`](/api/framework-context/src/type-aliases/runtimenativecontext/)

---

### platform

> **platform**: [`RuntimePlatform`](/api/framework-context/src/type-aliases/runtimeplatform/)

---

### requestId

> **requestId**: `string`

---

### trace?

> `optional` **trace?**: [`RuntimeTraceContext`](/api/framework-context/src/type-aliases/runtimetracecontext/)

## Methods

### flush()

> **flush**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### waitUntil()

> **waitUntil**(`promise`): `void`

#### Parameters

##### promise

`Promise`\<`unknown`\>

#### Returns

`void`
