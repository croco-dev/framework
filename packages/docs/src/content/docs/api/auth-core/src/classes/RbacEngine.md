---
editUrl: false
next: false
prev: false
title: "RbacEngine"
---

Defined in: [packages/auth-core/src/libs/rbac/RbacEngine.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/rbac/RbacEngine.ts#L5)

역할 기반 접근 제어 엔진입니다.

## Constructors

### Constructor

> **new RbacEngine**(`roleRegistry`): `RbacEngine`

Defined in: [packages/auth-core/src/libs/rbac/RbacEngine.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/rbac/RbacEngine.ts#L6)

#### Parameters

##### roleRegistry

[`AbstractRoleRegistry`](/api/auth-core/src/classes/abstractroleregistry/)

#### Returns

`RbacEngine`

## Methods

### hasPermission()

> **hasPermission**(`user`, `permission`): `boolean`

Defined in: [packages/auth-core/src/libs/rbac/RbacEngine.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/rbac/RbacEngine.ts#L8)

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

Defined in: [packages/auth-core/src/libs/rbac/RbacEngine.ts:23](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/rbac/RbacEngine.ts#L23)

#### Parameters

##### user

[`AuthUser`](/api/auth-core/src/type-aliases/authuser/)

##### role

`string`

#### Returns

`boolean`
