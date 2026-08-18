---
editUrl: false
next: false
prev: false
title: "TenantMiddleware"
---

tenant 미들웨어 계약과 결과 타입입니다.

## Methods

### canHandle()

> **canHandle**(`request`): `boolean`

Check if the middleware can handle the request

#### Parameters

##### request

`MiddlewareRequest`

The incoming request

#### Returns

`boolean`

True if the middleware can handle the request

---

### execute()

> **execute**(`request`, `guards?`): `Promise`\<[`TenantMiddlewareResult`](/api/tenant-core/src/type-aliases/tenantmiddlewareresult/)\>

Execute the middleware

#### Parameters

##### request

`MiddlewareRequest`

The incoming request

##### guards?

[`TenantGuard`](/api/tenant-core/src/interfaces/tenantguard/)[]

Tenant guards to apply

#### Returns

`Promise`\<[`TenantMiddlewareResult`](/api/tenant-core/src/type-aliases/tenantmiddlewareresult/)\>

The resolved tenant context
