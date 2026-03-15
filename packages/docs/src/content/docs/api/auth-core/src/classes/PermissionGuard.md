---
editUrl: false
next: false
prev: false
title: "PermissionGuard"
---

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:16](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/PermissionGuard.ts#L16)

Guard for permission-based authorization checks.

## Implements

- [`Guard`](/api/auth-core/src/interfaces/guard/)\<[`RouteExecutionContext`](/api/auth-core/src/type-aliases/routeexecutioncontext/)\>

## Constructors

### Constructor

> **new PermissionGuard**(`rbacEngine`): `PermissionGuard`

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:17](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/PermissionGuard.ts#L17)

#### Parameters

##### rbacEngine

[`RbacEngine`](/api/auth-core/src/classes/rbacengine/)

#### Returns

`PermissionGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `boolean`

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:19](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/auth-core/src/libs/guards/PermissionGuard.ts#L19)

#### Parameters

##### context

[`RouteExecutionContext`](/api/auth-core/src/type-aliases/routeexecutioncontext/)

#### Returns

`boolean`

#### Implementation of

[`Guard`](/api/auth-core/src/interfaces/guard/).[`canActivate`](/api/auth-core/src/interfaces/guard/#canactivate)
