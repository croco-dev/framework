---
editUrl: false
next: false
prev: false
title: "AuthGuard"
---

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:23](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/auth-core/src/libs/guards/AuthGuard.ts#L23)

Guard for user authentication and authorization.

## Implements

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new AuthGuard**(`authProvider`): `AuthGuard`

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:24](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/auth-core/src/libs/guards/AuthGuard.ts#L24)

#### Parameters

##### authProvider

[`AuthProvider`](/api/auth-core/src/interfaces/authprovider/)

#### Returns

`AuthGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:26](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/auth-core/src/libs/guards/AuthGuard.ts#L26)

#### Parameters

##### context

[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)
