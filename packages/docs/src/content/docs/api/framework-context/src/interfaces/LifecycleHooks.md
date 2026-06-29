---
editUrl: false
next: false
prev: false
title: "LifecycleHooks"
---

요청 라이프사이클 전후와 에러 상황에 실행할 훅 타입입니다.

## Example

```typescript
import type { LifecycleHooks } from '@croco/framework-context';

const hooks: LifecycleHooks = {
  onRequestStart: async (ctx) => {
    void ctx.requestId;
  },
};
```

## Type Parameters

### TContext

`TContext` = [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

## Properties

### onRequestEnd?

> `optional` **onRequestEnd?**: (`ctx`, `result?`) => `void` \| `Promise`\<`void`\>

요청 성공 종료 시 호출됩니다.

#### Parameters

##### ctx

`TContext`

##### result?

`unknown`

#### Returns

`void` \| `Promise`\<`void`\>

***

### onRequestError?

> `optional` **onRequestError?**: (`ctx`, `error`) => `void` \| `Promise`\<`void`\>

요청 에러 발생 시 호출됩니다.

#### Parameters

##### ctx

`TContext`

##### error

`Error`

#### Returns

`void` \| `Promise`\<`void`\>

***

### onRequestStart?

> `optional` **onRequestStart?**: (`ctx`) => `void` \| `Promise`\<`void`\>

요청 시작 시 호출됩니다.

#### Parameters

##### ctx

`TContext`

#### Returns

`void` \| `Promise`\<`void`\>
