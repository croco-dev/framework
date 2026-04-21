---
editUrl: false
next: false
prev: false
title: "MiddlewareChain"
---

Defined in: [packages/framework-context/src/libs/MiddlewareChain.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/MiddlewareChain.ts#L11)

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

Defined in: [packages/framework-context/src/libs/MiddlewareChain.ts:63](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/MiddlewareChain.ts#L63)

Clear all middlewares

#### Returns

`void`

***

### execute()

> **execute**\<`T`\>(`ctx`, `finalFn?`): `Promise`\<`T`\>

Defined in: [packages/framework-context/src/libs/MiddlewareChain.ts:25](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/MiddlewareChain.ts#L25)

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

Defined in: [packages/framework-context/src/libs/MiddlewareChain.ts:17](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/MiddlewareChain.ts#L17)

Add middleware to the chain

#### Parameters

##### middleware

[`Middleware`](/api/framework-context/src/type-aliases/middleware/)\<`TContext`\>

#### Returns

`this`
