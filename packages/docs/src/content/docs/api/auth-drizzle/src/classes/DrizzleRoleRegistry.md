---
editUrl: false
next: false
prev: false
title: "DrizzleRoleRegistry"
---

테넌트별 사용자 역할을 Drizzle로 관리하는 레지스트리입니다.

## Implements

- [`AbstractRoleRegistry`](/api/auth-core/src/classes/abstractroleregistry/)

## Constructors

### Constructor

> **new DrizzleRoleRegistry**(`db`, `schema`): `DrizzleRoleRegistry`

Drizzle DB와 역할 스키마를 받아 레지스트리를 초기화합니다.

#### Parameters

##### db

`DrizzleDb`

##### schema

###### userRoles

`PgTableWithColumns`\<\{ `columns`: \{ `createdAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"created_at"`; `notNull`: `true`; `tableName`: `"user_roles"`; \}, \{ \}, \{ \}\>; `id`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgUUID"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `true`; `name`: `"id"`; `notNull`: `true`; `tableName`: `"user_roles"`; \}, \{ \}, \{ \}\>; `role`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"role"`; `notNull`: `true`; `tableName`: `"user_roles"`; \}, \{ \}, \{ \}\>; `tenantId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"tenant_id"`; `notNull`: `true`; `tableName`: `"user_roles"`; \}, \{ \}, \{ \}\>; `userId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"user_id"`; `notNull`: `true`; `tableName`: `"user_roles"`; \}, \{ \}, \{ \}\>; \}; `dialect`: `"pg"`; `name`: `"user_roles"`; `schema`: `undefined`; \}\>

#### Returns

`DrizzleRoleRegistry`

## Methods

### assignRole()

> **assignRole**(`userId`, `tenantId`, `role`): `Promise`\<`void`\>

사용자에게 역할을 할당합니다.

#### Parameters

##### userId

`string`

##### tenantId

`string`

##### role

`string`

#### Returns

`Promise`\<`void`\>

---

### getPermissionsForRole()

> **getPermissionsForRole**(`role`): `string`[]

역할에 연결된 권한 목록을 반환합니다.

#### Parameters

##### role

`string`

#### Returns

`string`[]

---

### getRoleDefinition()

> **getRoleDefinition**(`role`): [`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/) \| `undefined`

등록된 역할 정의를 반환합니다.

#### Parameters

##### role

`string`

#### Returns

[`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/) \| `undefined`

---

### getRolePermissions()

> **getRolePermissions**(`role`, `visited?`): `string`[]

역할에 연결된 권한 목록을 반환합니다.

#### Parameters

##### role

`string`

##### visited?

`Set`\<`string`\> = `...`

#### Returns

`string`[]

#### Implementation of

[`AbstractRoleRegistry`](/api/auth-core/src/classes/abstractroleregistry/).[`getRolePermissions`](/api/auth-core/src/classes/abstractroleregistry/#getrolepermissions)

---

### getUserRoles()

> **getUserRoles**(`userId`, `tenantId`): `Promise`\<`string`[]\>

사용자와 테넌트에 할당된 역할 목록을 조회합니다.

#### Parameters

##### userId

`string`

##### tenantId

`string`

#### Returns

`Promise`\<`string`[]\>

---

### registerRole()

> **registerRole**(`role`, `definition`): `void`

역할 정의를 메모리에 등록합니다.

#### Parameters

##### role

`string`

##### definition

[`RoleDefinition`](/api/auth-core/src/type-aliases/roledefinition/)

#### Returns

`void`

---

### revokeRole()

> **revokeRole**(`userId`, `tenantId`, `role`): `Promise`\<`void`\>

사용자에게서 역할을 회수합니다.

#### Parameters

##### userId

`string`

##### tenantId

`string`

##### role

`string`

#### Returns

`Promise`\<`void`\>
