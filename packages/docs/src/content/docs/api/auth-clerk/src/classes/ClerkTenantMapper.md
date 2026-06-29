---
editUrl: false
next: false
prev: false
title: "ClerkTenantMapper"
---

Clerk 조직 ID와 Croco tenant ID를 매핑하는 매퍼입니다.

## Implements

- [`TenantMappingProvider`](/api/auth-core/src/interfaces/tenantmappingprovider/)
- [`TenantResolver`](/api/tenant-core/src/interfaces/tenantresolver/)\<[`ClerkTenantRequest`](/api/auth-clerk/src/type-aliases/clerktenantrequest/)\>

## Constructors

### Constructor

> **new ClerkTenantMapper**(`store?`): `ClerkTenantMapper`

#### Parameters

##### store?

[`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/)

#### Returns

`ClerkTenantMapper`

## Methods

### register()

> **register**(`externalOrgId`, `tenantId`): `Promise`\<`void`\>

#### Parameters

##### externalOrgId

`string`

##### tenantId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`TenantMappingProvider`](/api/auth-core/src/interfaces/tenantmappingprovider/).[`register`](/api/auth-core/src/interfaces/tenantmappingprovider/#register)

***

### remove()

> **remove**(`externalOrgId`): `Promise`\<`void`\>

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`TenantMappingProvider`](/api/auth-core/src/interfaces/tenantmappingprovider/).[`remove`](/api/auth-core/src/interfaces/tenantmappingprovider/#remove)

***

### resolve()

> **resolve**(`requestOrOrgId`): `Promise`\<`string` \| `null`\>

Resolve the tenant ID from the given request.

#### Parameters

##### requestOrOrgId

`string` \| [`ClerkTenantRequest`](/api/auth-clerk/src/type-aliases/clerktenantrequest/)

The incoming request object

#### Returns

`Promise`\<`string` \| `null`\>

The tenant ID if found, null otherwise

#### Implementation of

[`TenantResolver`](/api/tenant-core/src/interfaces/tenantresolver/).[`resolve`](/api/tenant-core/src/interfaces/tenantresolver/#resolve)
