---
editUrl: false
next: false
prev: false
title: "GraphQLAuthGuard"
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

> **new GraphQLAuthGuard**(`options`): `GraphQLAuthGuard`

#### Parameters

##### options

[`AuthGuardOptions`](/api/protocols-graphql/src/type-aliases/authguardoptions/)

#### Returns

`GraphQLAuthGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

#### Parameters

##### context

[`GraphQLGuardContext`](/api/protocols-graphql/src/type-aliases/graphqlguardcontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)
