---
editUrl: false
next: false
prev: false
title: "ApiKeyGuard"
---

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:7](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L7)

Guard for API key based authentication.

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new ApiKeyGuard**(`apiKeyProvider`): `ApiKeyGuard`

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:8](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L8)

#### Parameters

##### apiKeyProvider

[`ApiKeyProvider`](/api/auth-core/src/interfaces/apikeyprovider/)

#### Returns

`ApiKeyGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L10)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
