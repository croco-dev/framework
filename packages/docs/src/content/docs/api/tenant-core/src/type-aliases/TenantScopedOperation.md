---
editUrl: false
next: false
prev: false
title: "TenantScopedOperation"
---

> **TenantScopedOperation** = [`TenantScopedOperationMarker`](/api/tenant-core/src/type-aliases/tenantscopedoperationmarker/) & `object`

## Type Declaration

### bypass?

> `readonly` `optional` **bypass?**: [`TenantBypassReason`](/api/tenant-core/src/type-aliases/tenantbypassreason/)

### defaultTenantId?

> `readonly` `optional` **defaultTenantId?**: `string` \| `null`

### inputs?

> `readonly` `optional` **inputs?**: `Record`\<`string`, `unknown`\>

### isolation?

> `readonly` `optional` **isolation?**: [`TenantOperationIsolation`](/api/tenant-core/src/type-aliases/tenantoperationisolation/)

### kind

> `readonly` **kind**: [`TenantOperationKind`](/api/tenant-core/src/type-aliases/tenantoperationkind/)

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

### name

> `readonly` **name**: `string`

### requestedTenantId?

> `readonly` `optional` **requestedTenantId?**: `string` \| `null`

### resource?

> `readonly` `optional` **resource?**: `string`

### ruleId?

> `readonly` `optional` **ruleId?**: `string`

### sourceLocation?

> `readonly` `optional` **sourceLocation?**: [`PolicyDecisionSourceLocation`](/api/access-core/src/type-aliases/policydecisionsourcelocation/)

### tenantId?

> `readonly` `optional` **tenantId?**: `string` \| `null`
