---
editUrl: false
next: false
prev: false
title: "TenantManager"
---

Manages tenant context using AsyncLocalStorage.
Provides tenant isolation across async boundaries.

## Constructors

### Constructor

> **new TenantManager**(): `TenantManager`

#### Returns

`TenantManager`

## Methods

### getTenantId()

> **getTenantId**(): `string` \| `null`

Get the current tenant ID, or null if not in a tenant context.

#### Returns

`string` \| `null`

---

### isInTenantContext()

> **isInTenantContext**(): `boolean`

Check if currently within a tenant context.

#### Returns

`boolean`

---

### requireTenantId()

> **requireTenantId**(): `string`

Get the current tenant ID, throwing if not in a tenant context.
Use this when tenant context is required.

#### Returns

`string`

---

### run()

> **run**\<`T`\>(`tenantId`, `fn`): `Promise`\<`T`\>

Run a function within a tenant context.
The tenant context will be available to all async operations within.

#### Type Parameters

##### T

`T`

#### Parameters

##### tenantId

`string`

##### fn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

---

### suspend()

> **suspend**\<`T`\>(`fn`): `Promise`\<`T`\>

Run a function outside of the current tenant context.
Useful for cross-tenant operations or admin tasks.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
