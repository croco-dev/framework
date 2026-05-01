---
editUrl: false
next: false
prev: false
title: "MiddlewareChain"
---

등록된 미들웨어를 onion 패턴으로 순차 실행하는 체인입니다.

## Type Parameters

### TContext

`TContext` = `Record`\<`string`, `unknown`\>

## Constructors

### Constructor

> **new MiddlewareChain**\<`TContext`\>(): `MiddlewareChain`\<`TContext`\>

#### Returns

`MiddlewareChain`\<`TContext`\>

## Methods

### clear()

> **clear**(): `void`

Clear all middlewares

#### Returns

`void`

***

### execute()

> **execute**\<`T`\>(`ctx`, `finalFn?`): `Promise`\<`T`\>

Execute middleware chain in onion pattern

#### Type Parameters

##### T

`T`

#### Parameters

##### ctx

`TContext`

##### finalFn?

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### use()

> **use**(`middleware`): `this`

Add middleware to the chain

#### Parameters

##### middleware

[`Middleware`](/api/framework-context/src/type-aliases/middleware/)\<`TContext`\>

#### Returns

`this`
