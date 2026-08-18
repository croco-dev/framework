---
editUrl: false
next: false
prev: false
title: "TenantIsolationEvidence"
---

> **TenantIsolationEvidence** = `object`

## Properties

### bypassReason?

> `readonly` `optional` **bypassReason?**: [`TenantBypassReason`](/api/tenant-core/src/type-aliases/tenantbypassreason/)

***

### kind

> `readonly` **kind**: [`TenantOperationKind`](/api/tenant-core/src/type-aliases/tenantoperationkind/)

***

### operation

> `readonly` **operation**: `string`

***

### resource?

> `readonly` `optional` **resource?**: `string`

***

### status

> `readonly` **status**: `"tenant-scoped"` \| `"bypassed"`

***

### tenantId

> `readonly` **tenantId**: `string` \| `null`
