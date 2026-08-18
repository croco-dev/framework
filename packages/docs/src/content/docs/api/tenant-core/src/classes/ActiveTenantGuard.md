---
editUrl: false
next: false
prev: false
title: "ActiveTenantGuard"
---

활성 상태 테넌트만 허용하는 기본 가드입니다.

## Implements

- [`TenantGuard`](/api/tenant-core/src/interfaces/tenantguard/)

## Constructors

### Constructor

> **new ActiveTenantGuard**(`options?`): `ActiveTenantGuard`

#### Parameters

##### options?

`ActiveTenantGuardOptions` = `{}`

#### Returns

`ActiveTenantGuard`

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

#### Implementation of

[`TenantGuard`](/api/tenant-core/src/interfaces/tenantguard/).[`canAccess`](/api/tenant-core/src/interfaces/tenantguard/#canaccess)

---

### getName()

> **getName**(): `string`

Get the guard name

#### Returns

`string`

The guard name

#### Implementation of

[`TenantGuard`](/api/tenant-core/src/interfaces/tenantguard/).[`getName`](/api/tenant-core/src/interfaces/tenantguard/#getname)
