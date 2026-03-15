---
editUrl: false
next: false
prev: false
title: "UnifiedAuthGuard"
---

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:24](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L24)

Unified guard supporting principal and API key flows.

## Implements

- [`Guard`](/api/auth-core/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/type-aliases/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new UnifiedAuthGuard**(`authProvider`, `apiKeyProvider`): `UnifiedAuthGuard`

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:25](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L25)

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

Defined in: [packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts:30](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/UnifiedAuthGuard.ts#L30)

#### Parameters

##### context

[`RouteExecutionContext`](/api/auth-core/src/type-aliases/routeexecutioncontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/auth-core/src/interfaces/guard/).[`canActivate`](/api/auth-core/src/interfaces/guard/#canactivate)
