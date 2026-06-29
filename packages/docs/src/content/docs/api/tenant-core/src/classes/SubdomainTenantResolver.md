---
editUrl: false
next: false
prev: false
title: "SubdomainTenantResolver"
---

서브도메인에서 tenantId를 해석하는 resolver입니다.

## Implements

- [`TenantResolver`](/api/tenant-core/src/interfaces/tenantresolver/)\<`SubdomainRequest`\>

## Constructors

### Constructor

> **new SubdomainTenantResolver**(`options?`): `SubdomainTenantResolver`

#### Parameters

##### options?

`SubdomainTenantResolverOptions` = `{}`

#### Returns

`SubdomainTenantResolver`

## Methods

### resolve()

> **resolve**(`request`): `Promise`\<`string` \| `null`\>

Resolve the tenant ID from the given request.

#### Parameters

##### request

`SubdomainRequest`

The incoming request object

#### Returns

`Promise`\<`string` \| `null`\>

The tenant ID if found, null otherwise

#### Implementation of

[`TenantResolver`](/api/tenant-core/src/interfaces/tenantresolver/).[`resolve`](/api/tenant-core/src/interfaces/tenantresolver/#resolve)
