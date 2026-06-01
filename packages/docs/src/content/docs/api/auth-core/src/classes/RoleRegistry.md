---
editUrl: false
next: false
prev: false
title: "RoleRegistry"
---

역할 정의 타입과 역할 레지스트리 구현체입니다.

## Extends

- [`AbstractRoleRegistry`](/api/auth-core/src/classes/abstractroleregistry/)

## Constructors

### Constructor

> **new RoleRegistry**(): `RoleRegistry`

#### Returns

`RoleRegistry`

#### Inherited from

[`AbstractRoleRegistry`](/api/auth-core/src/classes/abstractroleregistry/).[`constructor`](/api/auth-core/src/classes/abstractroleregistry/#constructor)

## Methods

### getRole()

> **getRole**(`name`): [`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/)

#### Parameters

##### name

`string`

#### Returns

[`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/)

***

### getRolePermissions()

> **getRolePermissions**(`name`, `visited?`): `string`[]

#### Parameters

##### name

`string`

##### visited?

`Set`\<`string`\> = `...`

#### Returns

`string`[]

#### Overrides

[`AbstractRoleRegistry`](/api/auth-core/src/classes/abstractroleregistry/).[`getRolePermissions`](/api/auth-core/src/classes/abstractroleregistry/#getrolepermissions)

***

### register()

> **register**(`role`): `void`

#### Parameters

##### role

[`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/)

#### Returns

`void`
