---
editUrl: false
next: false
prev: false
title: "Guard"
---

Defined in: [packages/framework-context/src/libs/Guard.ts:1](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Guard.ts#L1)

요청을 계속 처리할 수 있는지 판단하는 Guard 인터페이스입니다.

## Example

```typescript
import type { Guard } from '@croco/framework-context';

const guard: Guard<{ userId: string }> = {
  canActivate(context) {
    return context.userId !== undefined;
  },
};
```

## Type Parameters

### TContext

`TContext` = `unknown`

Guard 실행 컨텍스트 타입입니다.

## Methods

### canActivate()

> **canActivate**(`context`): `boolean` \| `Promise`\<`boolean`\>

Defined in: [packages/framework-context/src/libs/Guard.ts:2](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Guard.ts#L2)

#### Parameters

##### context

`TContext`

#### Returns

`boolean` \| `Promise`\<`boolean`\>
