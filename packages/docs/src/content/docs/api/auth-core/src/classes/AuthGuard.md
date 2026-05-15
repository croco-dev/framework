---
editUrl: false
next: false
prev: false
title: "AuthGuard"
---

사용자 인증을 검사하는 기본 인증 가드입니다.

## Implements

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new AuthGuard**(): `AuthGuard`

#### Returns

`AuthGuard`

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
