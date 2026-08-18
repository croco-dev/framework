---
editUrl: false
next: false
prev: false
title: "TenantRepositoryBoundary"
---

> **TenantRepositoryBoundary** = `object`

## Methods

### query()

> **query**\<`TResult`\>(`boundary`, `fn`): `Promise`\<`TResult`\>

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### boundary

`Omit`\<[`TenantQueryBoundary`](/api/tenant-core/src/type-aliases/tenantqueryboundary/), `"operation"`\> & `object`

##### fn

(`evidence`) => `TResult` \| `Promise`\<`TResult`\>

#### Returns

`Promise`\<`TResult`\>

***

### read()

> **read**\<`TResult`\>(`operation`, `fn`): `Promise`\<`TResult`\>

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### operation

`Omit`\<[`TenantScopedOperation`](/api/tenant-core/src/type-aliases/tenantscopedoperation/), `"kind"`\> & `Partial`\<`Pick`\<[`TenantScopedOperation`](/api/tenant-core/src/type-aliases/tenantscopedoperation/), `"kind"`\>\>

##### fn

(`evidence`) => `TResult` \| `Promise`\<`TResult`\>

#### Returns

`Promise`\<`TResult`\>

***

### write()

> **write**\<`TResult`\>(`operation`, `fn`): `Promise`\<`TResult`\>

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### operation

`Omit`\<[`TenantScopedOperation`](/api/tenant-core/src/type-aliases/tenantscopedoperation/), `"kind"`\> & `Partial`\<`Pick`\<[`TenantScopedOperation`](/api/tenant-core/src/type-aliases/tenantscopedoperation/), `"kind"`\>\>

##### fn

(`evidence`) => `TResult` \| `Promise`\<`TResult`\>

#### Returns

`Promise`\<`TResult`\>
