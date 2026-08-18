---
editUrl: false
next: false
prev: false
title: "GraphQLRolesGuard"
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

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`GraphQLGuardContext`](/api/protocols-graphql/src/type-aliases/graphqlguardcontext/)\>

## Constructors

### Constructor

> **new GraphQLRolesGuard**(`resolverTarget?`, `resolverMethodName?`): `GraphQLRolesGuard`

#### Parameters

##### resolverTarget?

`object`

##### resolverMethodName?

`string`

#### Returns

`GraphQLRolesGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `boolean`

#### Parameters

##### context

[`GraphQLGuardContext`](/api/protocols-graphql/src/type-aliases/graphqlguardcontext/)

#### Returns

`boolean`

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)
