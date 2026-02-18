---
editUrl: false
next: false
prev: false
title: "PermissionGuard"
---

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:13](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/auth-core/src/libs/guards/PermissionGuard.ts#L13)

## Implements

- `Guard`\<`ExecutionContext`\>

## Constructors

### Constructor

> **new PermissionGuard**(`rbacEngine`): `PermissionGuard`

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:14](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/auth-core/src/libs/guards/PermissionGuard.ts#L14)

#### Parameters

##### rbacEngine

[`RbacEngine`](/api/auth-core/src/classes/rbacengine/)

#### Returns

`PermissionGuard`

## Methods

### canActivate()

> **canActivate**(`context`): `boolean`

Defined in: [packages/auth-core/src/libs/guards/PermissionGuard.ts:16](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/auth-core/src/libs/guards/PermissionGuard.ts#L16)

#### Parameters

##### context

`ExecutionContext`

#### Returns

`boolean`

#### Implementation of

`Guard.canActivate`
