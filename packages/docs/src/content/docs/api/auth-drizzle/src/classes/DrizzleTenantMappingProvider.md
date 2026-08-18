---
editUrl: false
next: false
prev: false
title: "DrizzleTenantMappingProvider"
---

외부 조직 ID와 내부 테넌트 ID를 매핑하는 Drizzle 구현체입니다.

## Implements

- [`TenantMappingProvider`](/api/auth-core/src/interfaces/tenantmappingprovider/)

## Constructors

### Constructor

> **new DrizzleTenantMappingProvider**(`db`, `schema`): `DrizzleTenantMappingProvider`

Drizzle DB와 테넌트 매핑 스키마를 받아 제공자를 초기화합니다.

#### Parameters

##### db

`DrizzleDb`

##### schema

###### tenantMappings

`PgTableWithColumns`\<\{ `columns`: \{ `createdAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"created_at"`; `notNull`: `true`; `tableName`: `"tenant_mappings"`; \}, \{ \}, \{ \}\>; `externalOrgId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"external_org_id"`; `notNull`: `true`; `tableName`: `"tenant_mappings"`; \}, \{ \}, \{ \}\>; `id`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgUUID"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `true`; `name`: `"id"`; `notNull`: `true`; `tableName`: `"tenant_mappings"`; \}, \{ \}, \{ \}\>; `tenantId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"tenant_id"`; `notNull`: `true`; `tableName`: `"tenant_mappings"`; \}, \{ \}, \{ \}\>; `updatedAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"updated_at"`; `notNull`: `true`; `tableName`: `"tenant_mappings"`; \}, \{ \}, \{ \}\>; \}; `dialect`: `"pg"`; `name`: `"tenant_mappings"`; `schema`: `undefined`; \}\>

#### Returns

`DrizzleTenantMappingProvider`

## Methods

### register()

> **register**(`externalOrgId`, `tenantId`): `Promise`\<`void`\>

외부 조직 ID와 테넌트 ID 매핑을 등록합니다.

#### Parameters

##### externalOrgId

`string`

##### tenantId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`TenantMappingProvider`](/api/auth-core/src/interfaces/tenantmappingprovider/).[`register`](/api/auth-core/src/interfaces/tenantmappingprovider/#register)

---

### remove()

> **remove**(`externalOrgId`): `Promise`\<`void`\>

외부 조직 ID 매핑을 제거합니다.

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`TenantMappingProvider`](/api/auth-core/src/interfaces/tenantmappingprovider/).[`remove`](/api/auth-core/src/interfaces/tenantmappingprovider/#remove)

---

### resolve()

> **resolve**(`externalOrgId`): `Promise`\<`string` \| `null`\>

외부 조직 ID에 연결된 테넌트 ID를 조회합니다.

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

[`TenantMappingProvider`](/api/auth-core/src/interfaces/tenantmappingprovider/).[`resolve`](/api/auth-core/src/interfaces/tenantmappingprovider/#resolve)
