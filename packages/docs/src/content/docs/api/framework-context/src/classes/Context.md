---
editUrl: false
next: false
prev: false
title: "Context"
---

Defined in: [packages/framework-context/src/libs/Context.ts:13](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L13)

요청 단위 컨텍스트를 실행하고 조회하는 AsyncLocalStorage 기반 유틸리티 클래스입니다.

## Param

`Context.run(context, fn)`에 전달할 요청 컨텍스트입니다.

## Example

```typescript
import { Context } from '@croco/framework-context';

const requestId = await Context.run({ requestId: 'req-123' }, async () => {
  return Context.getRequestId();
});
```

## Constructors

### Constructor

> **new Context**(): `Context`

#### Returns

`Context`

## Methods

### get()

> `static` **get**(): [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/) \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L25)

#### Returns

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/) \| `null`

***

### getActiveTraceId()

> `static` **getActiveTraceId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:61](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L61)

Get active trace ID from request context propagation

#### Returns

`string` \| `null`

***

### getCache()

> `static` **getCache**(): `Map`\<`string` \| [`Constructor`](/api/framework-context/src/type-aliases/constructor/), `unknown`\> \| `undefined`

Defined in: [packages/framework-context/src/libs/Context.ts:54](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L54)

#### Returns

`Map`\<`string` \| [`Constructor`](/api/framework-context/src/type-aliases/constructor/), `unknown`\> \| `undefined`

***

### getCreatedAt()

> `static` **getCreatedAt**(): `number` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:49](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L49)

#### Returns

`number` \| `null`

***

### getCurrentUser()

> `static` **getCurrentUser**(): `UserContext` \| `null` \| `undefined`

Defined in: [packages/framework-context/src/libs/Context.ts:35](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L35)

#### Returns

`UserContext` \| `null` \| `undefined`

***

### getRequestId()

> `static` **getRequestId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:30](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L30)

#### Returns

`string` \| `null`

***

### getTenantId()

> `static` **getTenantId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:40](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L40)

#### Returns

`string` \| `null`

***

### isActive()

> `static` **isActive**(): `boolean`

Defined in: [packages/framework-context/src/libs/Context.ts:45](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L45)

#### Returns

`boolean`

***

### run()

> `static` **run**\<`T`\>(`context`, `fn`): `T` \| `Promise`\<`T`\>

Defined in: [packages/framework-context/src/libs/Context.ts:16](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L16)

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

Defined in: [packages/framework-context/src/libs/Context.ts:71](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Context.ts#L71)

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
