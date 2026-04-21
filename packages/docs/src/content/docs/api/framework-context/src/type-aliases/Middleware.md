---
editUrl: false
next: false
prev: false
title: "Middleware"
---

> **Middleware**\<`TContext`\> = (`ctx`, `next`) => `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:27](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L27)

컨텍스트와 `next` 함수를 받아 실행되는 미들웨어 함수 타입입니다.

## Type Parameters

### TContext

`TContext` = [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

## Parameters

### ctx

`TContext`

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\>

## Example

```typescript
import type { Middleware } from '@croco/framework-context';

const middleware: Middleware = async (_ctx, next) => {
  await next();
};
```
