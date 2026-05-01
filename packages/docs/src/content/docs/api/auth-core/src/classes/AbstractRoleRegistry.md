---
editUrl: false
next: false
prev: false
title: "AbstractRoleRegistry"
---

역할 레지스트리 구현이 따라야 하는 추상 계약입니다.

## Extended by

- [`RoleRegistry`](/api/auth-core/src/classes/roleregistry/)

## Constructors

### Constructor

> **new AbstractRoleRegistry**(): `AbstractRoleRegistry`

#### Returns

`AbstractRoleRegistry`

## Methods

### getRolePermissions()

> `abstract` **getRolePermissions**(`name`, `visited?`): `string`[]

#### Parameters

##### name

`string`

##### visited?

`Set`\<`string`\>

#### Returns

`string`[]
