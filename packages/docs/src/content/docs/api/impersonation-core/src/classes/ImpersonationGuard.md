---
editUrl: false
next: false
prev: false
title: "ImpersonationGuard"
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

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new ImpersonationGuard**(): `ImpersonationGuard`

#### Returns

`ImpersonationGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `boolean`

#### Parameters

##### context

[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)

#### Returns

`boolean`

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)
