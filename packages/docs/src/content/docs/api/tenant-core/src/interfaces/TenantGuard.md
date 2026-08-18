---
editUrl: false
next: false
prev: false
title: "TenantGuard"
---

테넌트 접근 가드 인터페이스입니다.

## Methods

### canAccess()

> **canAccess**(`tenant`): `boolean`

Check if the tenant is allowed

#### Parameters

##### tenant

[`Tenant`](/api/tenant-core/src/type-aliases/tenant/)

The resolved tenant

#### Returns

`boolean`

True if allowed, false otherwise

---

### getName()

> **getName**(): `string`

Get the guard name

#### Returns

`string`

The guard name
