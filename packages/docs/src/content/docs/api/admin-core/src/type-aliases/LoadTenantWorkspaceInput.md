---
editUrl: false
next: false
prev: false
title: "LoadTenantWorkspaceInput"
---

> **LoadTenantWorkspaceInput** = `object`

## Properties

### actions?

> `readonly` `optional` **actions?**: readonly ([`AdminAction`](/api/admin-core/src/type-aliases/adminaction/) \| [`TenantWorkspaceAction`](/api/admin-core/src/type-aliases/tenantworkspaceaction/))[]

---

### generatedAt?

> `readonly` `optional` **generatedAt?**: `Date`

---

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

---

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

---

### sources

> `readonly` **sources**: readonly [`TenantBusinessSource`](/api/admin-core/src/interfaces/tenantbusinesssource/)\<[`TenantWorkspaceSourceData`](/api/admin-core/src/type-aliases/tenantworkspacesourcedata/)\>[]

---

### tenantId

> `readonly` **tenantId**: `string`
