---
editUrl: false
next: false
prev: false
title: "MiddlewareChain"
---

Defined in: [packages/framework-context/src/libs/types.ts:55](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/framework-context/src/libs/types.ts#L55)

Middleware chain class for executing middleware in onion pattern

## Type Parameters

### TContext

`TContext` = [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

## Constructors

### Constructor

> **new MiddlewareChain**\<`TContext`\>(): `MiddlewareChain`\<`TContext`\>

#### Returns

`MiddlewareChain`\<`TContext`\>

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/framework-context/src/libs/types.ts:92](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/framework-context/src/libs/types.ts#L92)

Clear all middlewares

#### Returns

`void`

***

### execute()

> **execute**(`ctx`): `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:69](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/framework-context/src/libs/types.ts#L69)

Execute middleware chain in onion pattern

#### Parameters

##### ctx

`TContext`

#### Returns

`Promise`\<`void`\>

***

### use()

> **use**(`middleware`): `this`

Defined in: [packages/framework-context/src/libs/types.ts:61](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/framework-context/src/libs/types.ts#L61)

Add middleware to the chain

#### Parameters

##### middleware

[`Middleware`](/api/framework-context/src/type-aliases/middleware/)\<`TContext`\>

#### Returns

`this`
