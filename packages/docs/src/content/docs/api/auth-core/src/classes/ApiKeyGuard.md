---
editUrl: false
next: false
prev: false
title: "ApiKeyGuard"
---

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:7](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L7)

Guard for API key based authentication.

## Implements

- [`Guard`](/api/auth-core/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/type-aliases/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new ApiKeyGuard**(`apiKeyProvider`): `ApiKeyGuard`

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:8](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L8)

#### Parameters

##### apiKeyProvider

[`ApiKeyProvider`](/api/auth-core/src/interfaces/apikeyprovider/)

#### Returns

`ApiKeyGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/ApiKeyGuard.ts:10](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/ApiKeyGuard.ts#L10)

#### Parameters

##### context

[`RouteExecutionContext`](/api/auth-core/src/type-aliases/routeexecutioncontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/auth-core/src/interfaces/guard/).[`canActivate`](/api/auth-core/src/interfaces/guard/#canactivate)
