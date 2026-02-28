---
editUrl: false
next: false
prev: false
title: "UnifiedAuthGuard"
---

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:20](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L20)

Unified guard supporting principal and API key flows.

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new UnifiedAuthGuard**(`authProvider`, `apiKeyProvider`): `UnifiedAuthGuard`

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:21](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L21)

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

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:26](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L26)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
