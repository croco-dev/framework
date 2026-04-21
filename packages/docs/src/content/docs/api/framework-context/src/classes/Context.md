---
editUrl: false
next: false
prev: false
title: "Context"
---

Defined in: [packages/framework-context/src/libs/Context.ts:16](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L16)

AsyncLocalStorage 기반으로 요청 컨텍스트를 실행하고 조회하는 유틸리티입니다.

## Constructors

### Constructor

> **new Context**(): `Context`

#### Returns

`Context`

## Methods

### get()

> `static` **get**(): [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/) \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L28)

#### Returns

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/) \| `null`

***

### getActiveTraceId()

> `static` **getActiveTraceId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:64](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L64)

Get active trace ID from request context propagation

#### Returns

`string` \| `null`

***

### getCache()

> `static` **getCache**(): `Map`\<`string` \| [`Constructor`](/api/framework-context/src/type-aliases/constructor/), `unknown`\> \| `undefined`

Defined in: [packages/framework-context/src/libs/Context.ts:57](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L57)

#### Returns

`Map`\<`string` \| [`Constructor`](/api/framework-context/src/type-aliases/constructor/), `unknown`\> \| `undefined`

***

### getCreatedAt()

> `static` **getCreatedAt**(): `number` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:52](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L52)

#### Returns

`number` \| `null`

***

### getCurrentUser()

> `static` **getCurrentUser**(): `UserContext` \| `null` \| `undefined`

Defined in: [packages/framework-context/src/libs/Context.ts:38](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L38)

#### Returns

`UserContext` \| `null` \| `undefined`

***

### getRequestId()

> `static` **getRequestId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:33](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L33)

#### Returns

`string` \| `null`

***

### getTenantId()

> `static` **getTenantId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:43](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L43)

#### Returns

`string` \| `null`

***

### isActive()

> `static` **isActive**(): `boolean`

Defined in: [packages/framework-context/src/libs/Context.ts:48](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L48)

#### Returns

`boolean`

***

### run()

> `static` **run**\<`T`\>(`context`, `fn`): `T` \| `Promise`\<`T`\>

Defined in: [packages/framework-context/src/libs/Context.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L19)

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

Defined in: [packages/framework-context/src/libs/Context.ts:74](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Context.ts#L74)

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
