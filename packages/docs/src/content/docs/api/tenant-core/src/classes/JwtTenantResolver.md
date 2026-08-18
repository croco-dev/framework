---
editUrl: false
next: false
prev: false
title: "JwtTenantResolver"
---

JWT claim에서 tenantId를 해석하는 resolver입니다.

## Type Parameters

### TRequest

`TRequest` *extends* `JwtRequest` = `JwtRequest`

## Implements

- [`TenantResolver`](/api/tenant-core/src/interfaces/tenantresolver/)\<`TRequest`\>

## Constructors

### Constructor

> **new JwtTenantResolver**\<`TRequest`\>(`config?`): `JwtTenantResolver`\<`TRequest`\>

#### Parameters

##### config?

`string` \| `JwtTenantResolverOptions`\<`TRequest`\>

#### Returns

`JwtTenantResolver`\<`TRequest`\>

## Methods

### resolve()

> **resolve**(`request`): `Promise`\<`string` \| `null`\>

Resolve the tenant ID from the given request.

#### Parameters

##### request

`TRequest`

The incoming request object

#### Returns

`Promise`\<`string` \| `null`\>

The tenant ID if found, null otherwise

#### Implementation of

[`TenantResolver`](/api/tenant-core/src/interfaces/tenantresolver/).[`resolve`](/api/tenant-core/src/interfaces/tenantresolver/#resolve)
