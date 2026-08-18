---
editUrl: false
next: false
prev: false
title: "TenantIsolationStrategy"
---

Interface for tenant data isolation strategies.
Implementations provide different isolation approaches for multi-tenant data.

## Methods

### buildFilter()

> **buildFilter**(`tenantId`): [`TenantIsolationFilter`](/api/tenant-core/src/type-aliases/tenantisolationfilter/) \| `null`

Build SQL filter for tenant isolation (for row-level strategy)

#### Parameters

##### tenantId

`string`

Tenant ID

#### Returns

[`TenantIsolationFilter`](/api/tenant-core/src/type-aliases/tenantisolationfilter/) \| `null`

SQL condition or null if not applicable

---

### getRowLevelColumnName()

> **getRowLevelColumnName**(): `string` \| `null`

Get the column name for row-level filtering

#### Returns

`string` \| `null`

Column name or null if not applicable

---

### getSchemaName()

> **getSchemaName**(`tenantId`): `string` \| `null`

Get the schema name for a tenant (for schema-per-tenant strategy)

#### Parameters

##### tenantId

`string`

Tenant ID

#### Returns

`string` \| `null`

Schema name or null if not applicable

---

### getType()

> **getType**(): [`TenantIsolationType`](/api/tenant-core/src/type-aliases/tenantisolationtype/)

Get the isolation type

#### Returns

[`TenantIsolationType`](/api/tenant-core/src/type-aliases/tenantisolationtype/)

The isolation strategy type

---

### supports()

> **supports**(`type`): `boolean`

Check if the strategy supports the given isolation type

#### Parameters

##### type

[`TenantIsolationType`](/api/tenant-core/src/type-aliases/tenantisolationtype/)

Isolation type to check

#### Returns

`boolean`

True if supported
