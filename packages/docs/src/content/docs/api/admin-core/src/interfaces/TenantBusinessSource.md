---
editUrl: false
next: false
prev: false
title: "TenantBusinessSource"
---

## Type Parameters

### TState

`TState` *extends* [`TenantWorkspaceSourceData`](/api/admin-core/src/type-aliases/tenantworkspacesourcedata/)

## Properties

### id

> `readonly` **id**: `string`

***

### label

> `readonly` **label**: `string`

***

### requiredPermissions

> `readonly` **requiredPermissions**: readonly `string`[]

***

### section

> `readonly` **section**: [`TenantWorkspaceSectionId`](/api/admin-core/src/type-aliases/tenantworkspacesectionid/)

## Methods

### load()

> **load**(`input`): `Promise`\<[`TenantSourceResult`](/api/admin-core/src/type-aliases/tenantsourceresult/)\<`TState`\>\>

#### Parameters

##### input

###### signal?

`AbortSignal`

###### tenantId

`string`

#### Returns

`Promise`\<[`TenantSourceResult`](/api/admin-core/src/type-aliases/tenantsourceresult/)\<`TState`\>\>
