---
editUrl: false
next: false
prev: false
title: "HeaderTenantResolver"
---

HTTP 헤더에서 tenantId를 해석하는 resolver입니다.

## Implements

- [`TenantResolver`](/api/tenant-core/src/interfaces/tenantresolver/)\<`HeaderRequest`\>

## Constructors

### Constructor

> **new HeaderTenantResolver**(`options?`): `HeaderTenantResolver`

#### Parameters

##### options?

`HeaderTenantResolverOptions` = `{}`

#### Returns

`HeaderTenantResolver`

## Methods

### resolve()

> **resolve**(`request`): `Promise`\<`string` \| `null`\>

Resolve the tenant ID from the given request.

#### Parameters

##### request

`HeaderRequest`

The incoming request object

#### Returns

`Promise`\<`string` \| `null`\>

The tenant ID if found, null otherwise

#### Implementation of

[`TenantResolver`](/api/tenant-core/src/interfaces/tenantresolver/).[`resolve`](/api/tenant-core/src/interfaces/tenantresolver/#resolve)
