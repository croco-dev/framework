---
editUrl: false
next: false
prev: false
title: "PermissionGuard"
---

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:17](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/guards/PermissionGuard.ts#L17)

권한 기반 인가를 수행하는 가드입니다.

## Implements

- [`Guard`](/api/framework-context/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new PermissionGuard**(`rbacEngine`): `PermissionGuard`

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:18](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/guards/PermissionGuard.ts#L18)

#### Parameters

##### rbacEngine

[`RbacEngine`](/api/auth-core/src/classes/rbacengine/)

#### Returns

`PermissionGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `boolean`

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/guards/PermissionGuard.ts#L20)

#### Parameters

##### context

[`RouteExecutionContext`](/api/auth-core/src/interfaces/routeexecutioncontext/)

#### Returns

`boolean`

#### Implementation of

[`Guard`](/api/framework-context/src/interfaces/guard/).[`canActivate`](/api/framework-context/src/interfaces/guard/#canactivate)
