---
editUrl: false
next: false
prev: false
title: "TenantMappingStoreConformanceOptions"
---

> **TenantMappingStoreConformanceOptions** = `object`

## Properties

### createStores

> `readonly` **createStores**: () => readonly \[[`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/), [`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/)\] \| `Promise`\<readonly \[[`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/), [`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/)\]\>

Creates two handles that share one backing mapping namespace.

#### Returns

readonly \[[`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/), [`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/)\] \| `Promise`\<readonly \[[`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/), [`TenantMappingStore`](/api/auth-clerk/src/interfaces/tenantmappingstore/)\]\>
