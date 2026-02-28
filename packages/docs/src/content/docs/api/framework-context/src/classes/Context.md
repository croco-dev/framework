---
editUrl: false
next: false
prev: false
title: "Context"
---

Defined in: [packages/framework-context/src/libs/Context.ts:14](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L14)

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

Defined in: [packages/framework-context/src/libs/Context.ts:26](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L26)

#### Returns

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/) \| `null`

***

### getActiveSpanId()

> `static` **getActiveSpanId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:78](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L78)

Get active span ID from OpenTelemetry context

#### Returns

`string` \| `null`

***

### getActiveTraceId()

> `static` **getActiveTraceId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:63](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L63)

Get active trace ID from OpenTelemetry context
Falls back to RequestContext.traceId for propagation

#### Returns

`string` \| `null`

***

### getCache()

> `static` **getCache**(): `Map`\<`string` \| [`Constructor`](/api/framework-context/src/type-aliases/constructor/), `unknown`\> \| `undefined`

Defined in: [packages/framework-context/src/libs/Context.ts:55](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L55)

#### Returns

`Map`\<`string` \| [`Constructor`](/api/framework-context/src/type-aliases/constructor/), `unknown`\> \| `undefined`

***

### getCreatedAt()

> `static` **getCreatedAt**(): `number` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:50](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L50)

#### Returns

`number` \| `null`

***

### getCurrentUser()

> `static` **getCurrentUser**(): `UserContext` \| `null` \| `undefined`

Defined in: [packages/framework-context/src/libs/Context.ts:36](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L36)

#### Returns

`UserContext` \| `null` \| `undefined`

***

### getRequestId()

> `static` **getRequestId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:31](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L31)

#### Returns

`string` \| `null`

***

### getTenantId()

> `static` **getTenantId**(): `string` \| `null`

Defined in: [packages/framework-context/src/libs/Context.ts:41](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L41)

#### Returns

`string` \| `null`

***

### isActive()

> `static` **isActive**(): `boolean`

Defined in: [packages/framework-context/src/libs/Context.ts:46](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L46)

#### Returns

`boolean`

***

### run()

> `static` **run**\<`T`\>(`context`, `fn`): `T` \| `Promise`\<`T`\>

Defined in: [packages/framework-context/src/libs/Context.ts:17](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L17)

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

Defined in: [packages/framework-context/src/libs/Context.ts:93](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Context.ts#L93)

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
