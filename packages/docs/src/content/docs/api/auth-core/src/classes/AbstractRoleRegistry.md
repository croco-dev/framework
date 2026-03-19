---
editUrl: false
next: false
prev: false
title: "AbstractRoleRegistry"
---

Defined in: [packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts:3](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts#L3)

Abstract role registry contract for dependency inversion.

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

Defined in: [packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts#L4)

#### Parameters

##### name

`string`

##### visited?

`Set`\<`string`\>

#### Returns

`string`[]
