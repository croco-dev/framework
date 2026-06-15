---
editUrl: false
next: false
prev: false
title: "RuntimeContextInit"
---

> **RuntimeContextInit** = `object`

## Properties

### capabilities?

> `optional` **capabilities**: `Partial`\<[`RuntimeCapabilities`](/api/framework-context/src/type-aliases/runtimecapabilities/)\>

***

### env?

> `optional` **env**: `Record`\<`string`, `unknown`\>

***

### flush()?

> `optional` **flush**: () => `Promise`\<`void`\> \| `void`

#### Returns

`Promise`\<`void`\> \| `void`

***

### logger?

> `optional` **logger**: [`ILogger`](/api/framework-context/src/interfaces/ilogger/)

***

### native?

> `optional` **native**: [`RuntimeNativeContext`](/api/framework-context/src/type-aliases/runtimenativecontext/)

***

### platform

> **platform**: [`RuntimePlatform`](/api/framework-context/src/type-aliases/runtimeplatform/)

***

### requestId?

> `optional` **requestId**: `string`

***

### shutdown()?

> `optional` **shutdown**: () => `Promise`\<`void`\> \| `void`

#### Returns

`Promise`\<`void`\> \| `void`

***

### trace?

> `optional` **trace**: [`RuntimeTraceContext`](/api/framework-context/src/type-aliases/runtimetracecontext/)

***

### waitUntil()?

> `optional` **waitUntil**: (`promise`) => `void`

#### Parameters

##### promise

`Promise`\<`unknown`\>

#### Returns

`void`
