---
editUrl: false
next: false
prev: false
title: "AuthGuard"
---

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:22](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/AuthGuard.ts#L22)

Guard for user authentication and authorization.

## Implements

- [`Guard`](/api/auth-core/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/type-aliases/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new AuthGuard**(`authProvider`): `AuthGuard`

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:23](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/AuthGuard.ts#L23)

#### Parameters

##### authProvider

[`AuthProvider`](/api/auth-core/src/interfaces/authprovider/)

#### Returns

`AuthGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/auth-core/src/libs/guards/AuthGuard.ts:25](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/AuthGuard.ts#L25)

#### Parameters

##### context

[`RouteExecutionContext`](/api/auth-core/src/type-aliases/routeexecutioncontext/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`Guard`](/api/auth-core/src/interfaces/guard/).[`canActivate`](/api/auth-core/src/interfaces/guard/#canactivate)
