---
editUrl: false
next: false
prev: false
title: "TenantIsolationEnforcer"
---

Tenant-scoped operation, repository/query boundary, RLS evidence, and leak fixture helpers.

## Constructors

### Constructor

> **new TenantIsolationEnforcer**(`options?`): `TenantIsolationEnforcer`

#### Parameters

##### options?

[`TenantIsolationEnforcerOptions`](/api/tenant-core/src/type-aliases/tenantisolationenforceroptions/) = `{}`

#### Returns

`TenantIsolationEnforcer`

## Methods

### assertQueryBoundary()

> **assertQueryBoundary**(`boundary`, `evidence`): `void`

#### Parameters

##### boundary

[`TenantQueryBoundary`](/api/tenant-core/src/type-aliases/tenantqueryboundary/)

##### evidence

[`TenantIsolationEvidence`](/api/tenant-core/src/type-aliases/tenantisolationevidence/)

#### Returns

`void`

***

### assertRlsEvidence()

> **assertRlsEvidence**(`rls`, `operation`, `activeTenantId`): `void`

#### Parameters

##### rls

[`TenantRlsEvidence`](/api/tenant-core/src/type-aliases/tenantrlsevidence/)

##### operation

[`TenantScopedOperation`](/api/tenant-core/src/type-aliases/tenantscopedoperation/)

##### activeTenantId

`string`

#### Returns

`void`

***

### createRepositoryBoundary()

> **createRepositoryBoundary**(`defaults?`): [`TenantRepositoryBoundary`](/api/tenant-core/src/type-aliases/tenantrepositoryboundary/)

#### Parameters

##### defaults?

`Partial`\<[`TenantScopedOperation`](/api/tenant-core/src/type-aliases/tenantscopedoperation/)\> = `{}`

#### Returns

[`TenantRepositoryBoundary`](/api/tenant-core/src/type-aliases/tenantrepositoryboundary/)

***

### enforce()

> **enforce**\<`TResult`\>(`operation`, `fn`): `Promise`\<`TResult`\>

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### operation

[`TenantScopedOperation`](/api/tenant-core/src/type-aliases/tenantscopedoperation/)

##### fn

(`evidence`) => `TResult` \| `Promise`\<`TResult`\>

#### Returns

`Promise`\<`TResult`\>

***

### enforceQuery()

> **enforceQuery**\<`TResult`\>(`boundary`, `fn`): `Promise`\<`TResult`\>

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### boundary

[`TenantQueryBoundary`](/api/tenant-core/src/type-aliases/tenantqueryboundary/)

##### fn

(`evidence`) => `TResult` \| `Promise`\<`TResult`\>

#### Returns

`Promise`\<`TResult`\>

***

### requireOperation()

> **requireOperation**(`operation`): `Promise`\<[`TenantIsolationEvidence`](/api/tenant-core/src/type-aliases/tenantisolationevidence/)\>

#### Parameters

##### operation

[`TenantScopedOperation`](/api/tenant-core/src/type-aliases/tenantscopedoperation/)

#### Returns

`Promise`\<[`TenantIsolationEvidence`](/api/tenant-core/src/type-aliases/tenantisolationevidence/)\>
