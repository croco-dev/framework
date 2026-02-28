---
editUrl: false
next: false
prev: false
title: "RoleRegistry"
---

Defined in: [packages/auth-core/src/libs/rbac/Role.ts:7](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/rbac/Role.ts#L7)

Role registry and role definition type.

## Constructors

### Constructor

> **new RoleRegistry**(): `RoleRegistry`

#### Returns

`RoleRegistry`

## Methods

### getRole()

> **getRole**(`name`): [`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/) \| `undefined`

Defined in: [packages/auth-core/src/libs/rbac/Role.ts:14](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/rbac/Role.ts#L14)

#### Parameters

##### name

`string`

#### Returns

[`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/) \| `undefined`

***

### getRolePermissions()

> **getRolePermissions**(`name`, `visited?`): `string`[]

Defined in: [packages/auth-core/src/libs/rbac/Role.ts:18](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/rbac/Role.ts#L18)

#### Parameters

##### name

`string`

##### visited?

`Set`\<`string`\> = `...`

#### Returns

`string`[]

***

### register()

> **register**(`role`): `void`

Defined in: [packages/auth-core/src/libs/rbac/Role.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/rbac/Role.ts#L10)

#### Parameters

##### role

[`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/)

#### Returns

`void`
