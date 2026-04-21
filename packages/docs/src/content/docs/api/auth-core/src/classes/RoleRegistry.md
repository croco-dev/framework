---
editUrl: false
next: false
prev: false
title: "RoleRegistry"
---

Defined in: [packages/auth-core/src/libs/rbac/Role.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/rbac/Role.ts#L9)

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

> **getRole**(`name`): [`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/) \| `undefined`

Defined in: [packages/auth-core/src/libs/rbac/Role.ts:16](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/rbac/Role.ts#L16)

#### Parameters

##### name

`string`

#### Returns

[`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/) \| `undefined`

***

### getRolePermissions()

> **getRolePermissions**(`name`, `visited?`): `string`[]

Defined in: [packages/auth-core/src/libs/rbac/Role.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/rbac/Role.ts#L20)

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

Defined in: [packages/auth-core/src/libs/rbac/Role.ts:12](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/rbac/Role.ts#L12)

#### Parameters

##### role

[`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/)

#### Returns

`void`
