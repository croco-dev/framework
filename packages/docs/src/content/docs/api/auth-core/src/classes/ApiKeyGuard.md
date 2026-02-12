---
editUrl: false
next: false
prev: false
title: "ApiKeyGuard"
---

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:6](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L6)

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new ApiKeyGuard**(`apiKeyProvider`): `ApiKeyGuard`

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:7](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L7)

#### Parameters

##### apiKeyProvider

[`ApiKeyProvider`](/api/auth-core/src/interfaces/apikeyprovider/)

#### Returns

`ApiKeyGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:9](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L9)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`Guard.canActivate`
