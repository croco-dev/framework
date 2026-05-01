---
editUrl: false
next: false
prev: false
title: "ApiKeyGuard"
---

API 키 기반 인증 가드입니다.

## Implements

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new ApiKeyGuard**(`apiKeyProvider`): `ApiKeyGuard`

#### Parameters

##### apiKeyProvider

[`ApiKeyProvider`](/api/auth-core/src/interfaces/apikeyprovider/)

#### Returns

`ApiKeyGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

#### Parameters

##### context

[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)
