---
editUrl: false
next: false
prev: false
title: "ApiKeyGuard"
---

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:6](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L6)

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new ApiKeyGuard**(`apiKeyProvider`): `ApiKeyGuard`

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:7](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L7)

#### Parameters

##### apiKeyProvider

[`ApiKeyProvider`](/api/auth-core/src/interfaces/apikeyprovider/)

#### Returns

`ApiKeyGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:9](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L9)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
