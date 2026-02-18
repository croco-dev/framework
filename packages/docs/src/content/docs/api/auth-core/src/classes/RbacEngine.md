---
editUrl: false
next: false
prev: false
title: "RbacEngine"
---

Defined in: [packages/auth-core/src/libs/rbac/RbacEngine.ts:5](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/auth-core/src/libs/rbac/RbacEngine.ts#L5)

## Constructors

### Constructor

> **new RbacEngine**(`roleRegistry`): `RbacEngine`

Defined in: [packages/auth-core/src/libs/rbac/RbacEngine.ts:6](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/auth-core/src/libs/rbac/RbacEngine.ts#L6)

#### Parameters

##### roleRegistry

[`RoleRegistry`](/api/auth-core/src/classes/roleregistry/)

#### Returns

`RbacEngine`

## Methods

### hasPermission()

> **hasPermission**(`user`, `permission`): `boolean`

Defined in: [packages/auth-core/src/libs/rbac/RbacEngine.ts:8](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/auth-core/src/libs/rbac/RbacEngine.ts#L8)

#### Parameters

##### user

[`AuthUser`](/api/auth-core/src/type-aliases/authuser/)

##### permission

`string`

#### Returns

`boolean`

***

### hasRole()

> **hasRole**(`user`, `role`): `boolean`

Defined in: [packages/auth-core/src/libs/rbac/RbacEngine.ts:23](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/auth-core/src/libs/rbac/RbacEngine.ts#L23)

#### Parameters

##### user

[`AuthUser`](/api/auth-core/src/type-aliases/authuser/)

##### role

`string`

#### Returns

`boolean`
