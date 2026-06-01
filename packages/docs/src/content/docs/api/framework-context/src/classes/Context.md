---
editUrl: false
next: false
prev: false
title: "Context"
---

AsyncLocalStorage 기반으로 요청 컨텍스트를 실행하고 조회하는 유틸리티입니다.

## Constructors

### Constructor

> **new Context**(): `Context`

#### Returns

`Context`

## Methods

### get()

> `static` **get**(): [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

***

### getActiveTraceId()

> `static` **getActiveTraceId**(): `string`

Get active trace ID from request context propagation

#### Returns

`string`

***

### getCache()

> `static` **getCache**(): `Map`\<`string` \| [`Constructor`](/api/framework-context/src/type-aliases/constructor/), `unknown`\>

#### Returns

`Map`\<`string` \| [`Constructor`](/api/framework-context/src/type-aliases/constructor/), `unknown`\>

***

### getCreatedAt()

> `static` **getCreatedAt**(): `number`

#### Returns

`number`

***

### getCurrentUser()

> `static` **getCurrentUser**(): `UserContext`

#### Returns

`UserContext`

***

### getRequestId()

> `static` **getRequestId**(): `string`

#### Returns

`string`

***

### getTenantId()

> `static` **getTenantId**(): `string`

#### Returns

`string`

***

### isActive()

> `static` **isActive**(): `boolean`

#### Returns

`boolean`

***

### run()

> `static` **run**\<`T`\>(`context`, `fn`): `T` \| `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

##### fn

() => `T` \| `Promise`\<`T`\>

#### Returns

`T` \| `Promise`\<`T`\>

***

### runWithMiddleware()

> `static` **runWithMiddleware**\<`T`\>(`context`, `middlewares`, `hooks`, `fn`): `Promise`\<`T`\>

Run a function with middleware chain and lifecycle hooks
Execution order: onRequestStart -> middleware chain -> fn -> onRequestEnd
If error occurs: onRequestError is called instead of onRequestEnd

#### Type Parameters

##### T

`T`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

##### middlewares

[`Middleware`](/api/framework-context/src/type-aliases/middleware/)[]

##### hooks

[`LifecycleHooks`](/api/framework-context/src/interfaces/lifecyclehooks/)\<[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)\>

##### fn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
