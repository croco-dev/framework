---
editUrl: false
next: false
prev: false
title: "AbstractRoleRegistry"
---

Defined in: [packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts:3](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts#L3)

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

Defined in: [packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts#L4)

#### Parameters

##### name

`string`

##### visited?

`Set`\<`string`\>

#### Returns

`string`[]
