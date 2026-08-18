---
editUrl: false
next: false
prev: false
title: "AccessGuard"
---

요청을 계속 처리할 수 있는지 판단하는 Guard 인터페이스입니다.

## Example

```typescript
import type { Guard } from "@croco/framework-context";

const guard: Guard<{ userId: string }> = {
  canActivate(context) {
    return context.userId !== undefined;
  },
};
```

## Implements

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`AccessExecutionContext`](/api/access-core/src/interfaces/accessexecutioncontext/)\>

## Constructors

### Constructor

> **new AccessGuard**(`accessEngine`): `AccessGuard`

#### Parameters

##### accessEngine

[`AccessEngine`](/api/access-core/src/classes/accessengine/)

#### Returns

`AccessGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

#### Parameters

##### context

[`AccessExecutionContext`](/api/access-core/src/interfaces/accessexecutioncontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)
