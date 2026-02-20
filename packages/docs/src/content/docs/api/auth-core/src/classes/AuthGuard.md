---
editUrl: false
next: false
prev: false
title: "AuthGuard"
---

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:7](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/auth-core/src/libs/guards/AuthGuard.ts#L7)

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new AuthGuard**(`authProvider`): `AuthGuard`

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:8](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/auth-core/src/libs/guards/AuthGuard.ts#L8)

#### Parameters

##### authProvider

[`AuthProvider`](/api/auth-core/src/interfaces/authprovider/)

#### Returns

`AuthGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:10](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/auth-core/src/libs/guards/AuthGuard.ts#L10)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
