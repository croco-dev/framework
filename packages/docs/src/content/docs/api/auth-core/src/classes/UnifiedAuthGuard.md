---
editUrl: false
next: false
prev: false
title: "UnifiedAuthGuard"
---

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:8](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L8)

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new UnifiedAuthGuard**(`authProvider`, `apiKeyProvider`): `UnifiedAuthGuard`

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:9](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L9)

#### Parameters

##### authProvider

[`AuthProvider`](/api/auth-core/src/interfaces/authprovider/)

##### apiKeyProvider

[`ApiKeyProvider`](/api/auth-core/src/interfaces/apikeyprovider/)

#### Returns

`UnifiedAuthGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:14](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L14)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
