---
editUrl: false
next: false
prev: false
title: "TenantStore"
---

Interface for tenant storage operations.
Implementations provide CRUD operations and settings management for tenants.

## Methods

### create()

> **create**(`data`): `Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)\>

Create a new tenant

#### Parameters

##### data

`Omit`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/), `"id"` \| `"createdAt"` \| `"updatedAt"`\>

Tenant data

#### Returns

`Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)\>

The created tenant

***

### delete()

> **delete**(`id`): `Promise`\<`boolean`\>

Delete a tenant by ID

#### Parameters

##### id

`string`

Tenant ID

#### Returns

`Promise`\<`boolean`\>

True if deleted, false if not found

***

### exists()

> **exists**(`id`): `Promise`\<`boolean`\>

Check if a tenant exists by ID

#### Parameters

##### id

`string`

Tenant ID

#### Returns

`Promise`\<`boolean`\>

True if exists, false otherwise

***

### findAll()

> **findAll**(`filter?`): `Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)[]\>

Find all tenants matching the filter

#### Parameters

##### filter?

[`TenantFilter`](/api/tenant-core/src/type-aliases/tenantfilter/)

Filter criteria

#### Returns

`Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)[]\>

Array of matching tenants

***

### findById()

> **findById**(`id`): `Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/) \| `null`\>

Find a tenant by ID

#### Parameters

##### id

`string`

Tenant ID

#### Returns

`Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/) \| `null`\>

The tenant if found, null otherwise

***

### findBySlug()

> **findBySlug**(`slug`): `Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/) \| `null`\>

Find a tenant by slug

#### Parameters

##### slug

`string`

Tenant slug/identifier

#### Returns

`Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/) \| `null`\>

The tenant if found, null otherwise

***

### update()

> **update**(`id`, `data`): `Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)\>

Update an existing tenant

#### Parameters

##### id

`string`

Tenant ID

##### data

`Partial`\<`Omit`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/), `"id"` \| `"createdAt"` \| `"updatedAt"`\>\>

Partial tenant data to update

#### Returns

`Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)\>

The updated tenant

***

### updateSettings()

> **updateSettings**(`id`, `settings`): `Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)\>

Update tenant settings

#### Parameters

##### id

`string`

Tenant ID

##### settings

`Partial`\<[`TenantSettings`](/api/tenant-core/src/type-aliases/tenantsettings/)\>

Partial settings to update

#### Returns

`Promise`\<[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)\>

The updated tenant
