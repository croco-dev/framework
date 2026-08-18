---
editUrl: false
next: false
prev: false
title: "createInMemoryTenantBusinessSource"
---

> **createInMemoryTenantBusinessSource**\<`TState`\>(`input`): [`TenantBusinessSource`](/api/admin-core/src/interfaces/tenantbusinesssource/)\<`TState`\>

## Type Parameters

### TState

`TState` _extends_ [`TenantWorkspaceSourceData`](/api/admin-core/src/type-aliases/tenantworkspacesourcedata/)

## Parameters

### input

#### id

`string`

#### label

`string`

#### requiredPermissions?

readonly `string`[]

#### result

[`TenantSourceResult`](/api/admin-core/src/type-aliases/tenantsourceresult/)\<`TState`\> \| ((`tenantId`) => TenantSourceResult\<TState\> \| Promise\<TenantSourceResult\<TState\>\>)

#### section

[`TenantWorkspaceSectionId`](/api/admin-core/src/type-aliases/tenantworkspacesectionid/)

## Returns

[`TenantBusinessSource`](/api/admin-core/src/interfaces/tenantbusinesssource/)\<`TState`\>
