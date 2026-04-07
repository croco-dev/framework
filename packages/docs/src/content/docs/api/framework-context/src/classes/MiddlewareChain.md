---
editUrl: false
next: false
prev: false
title: "MiddlewareChain"
---

Defined in: [packages/framework-context/src/libs/MiddlewareChain.ts:8](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/MiddlewareChain.ts#L8)

요청 컨텍스트에 미들웨어를 순차 실행하는 onion 패턴 체인 클래스입니다.

## Param

`chain.use(middleware)`에 등록할 미들웨어 함수입니다.

## Example

```typescript
import { MiddlewareChain } from '@croco/framework-context';

const chain = new MiddlewareChain<{ requestId: string }>();
chain.use(async (_ctx, next) => {
  await next();
});

await chain.execute({ requestId: 'req-123' });
```

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

Defined in: [packages/framework-context/src/libs/MiddlewareChain.ts:60](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/MiddlewareChain.ts#L60)

Clear all middlewares

#### Returns

`void`

***

### execute()

> **execute**\<`T`\>(`ctx`, `finalFn?`): `Promise`\<`T`\>

Defined in: [packages/framework-context/src/libs/MiddlewareChain.ts:22](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/MiddlewareChain.ts#L22)

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

Defined in: [packages/framework-context/src/libs/MiddlewareChain.ts:14](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/MiddlewareChain.ts#L14)

Add middleware to the chain

#### Parameters

##### middleware

[`Middleware`](/api/framework-context/src/type-aliases/middleware/)\<`TContext`\>

#### Returns

`this`
