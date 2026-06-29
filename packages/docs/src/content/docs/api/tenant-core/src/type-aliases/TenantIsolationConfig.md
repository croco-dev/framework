---
editUrl: false
next: false
prev: false
title: "TenantIsolationConfig"
---

> **TenantIsolationConfig** = \{ `getSchemaName`: (`tenantId`) => `string`; `type`: `"schema-per-tenant"`; \} \| \{ `columnName`: `string`; `sqlBuilder`: (`tenantId`) => [`TenantIsolationFilter`](/api/tenant-core/src/type-aliases/tenantisolationfilter/); `type`: `"row-level"`; \} \| \{ `columnName`: `string`; `default`: `"schema-per-tenant"` \| `"row-level"`; `getSchemaName`: (`tenantId`) => `string`; `sqlBuilder`: (`tenantId`) => [`TenantIsolationFilter`](/api/tenant-core/src/type-aliases/tenantisolationfilter/); `type`: `"hybrid"`; `useRowLevelForTenants?`: `string`[]; \}

Isolation strategy configuration
