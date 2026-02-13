---
editUrl: false
next: false
prev: false
title: "AuthGuard"
---

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:7](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/auth-core/src/libs/guards/AuthGuard.ts#L7)

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new AuthGuard**(`authProvider`): `AuthGuard`

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:8](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/auth-core/src/libs/guards/AuthGuard.ts#L8)

#### Parameters

##### authProvider

[`AuthProvider`](/api/auth-core/src/interfaces/authprovider/)

#### Returns

`AuthGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:10](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/auth-core/src/libs/guards/AuthGuard.ts#L10)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
