---
editUrl: false
next: false
prev: false
title: "RbacEngine"
---

역할 기반 접근 제어 엔진입니다.

## Constructors

### Constructor

> **new RbacEngine**(`roleRegistry`): `RbacEngine`

#### Parameters

##### roleRegistry

[`AbstractRoleRegistry`](/api/auth-core/src/classes/abstractroleregistry/)

#### Returns

`RbacEngine`

## Methods

### hasPermission()

> **hasPermission**(`user`, `permission`): `boolean`

#### Parameters

##### user

[`AuthUser`](/api/auth-core/src/type-aliases/authuser/)

##### permission

`string`

#### Returns

`boolean`

---

### hasRole()

> **hasRole**(`user`, `role`): `boolean`

#### Parameters

##### user

[`AuthUser`](/api/auth-core/src/type-aliases/authuser/)

##### role

`string`

#### Returns

`boolean`
