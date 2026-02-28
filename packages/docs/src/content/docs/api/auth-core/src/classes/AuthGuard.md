---
editUrl: false
next: false
prev: false
title: "AuthGuard"
---

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:18](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/AuthGuard.ts#L18)

Guard for user authentication and authorization.

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new AuthGuard**(`authProvider`): `AuthGuard`

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:19](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/AuthGuard.ts#L19)

#### Parameters

##### authProvider

[`AuthProvider`](/api/auth-core/src/interfaces/authprovider/)

#### Returns

`AuthGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:21](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/AuthGuard.ts#L21)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
