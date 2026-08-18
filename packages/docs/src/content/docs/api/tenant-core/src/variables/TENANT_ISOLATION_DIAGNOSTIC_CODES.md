---
editUrl: false
next: false
prev: false
title: "TENANT_ISOLATION_DIAGNOSTIC_CODES"
---

> `const` **TENANT_ISOLATION_DIAGNOSTIC_CODES**: `object`

Tenant isolation enforcement failures and stable diagnostic codes.

## Type Declaration

### adminBypassReasonRequired

> `readonly` **adminBypassReasonRequired**: `"tenant-core/admin-bypass-reason-required"` = `"tenant-core/admin-bypass-reason-required"`

### contextMissing

> `readonly` **contextMissing**: `"tenant-core/isolation-context-missing"` = `"tenant-core/isolation-context-missing"`

### crossTenantLeak

> `readonly` **crossTenantLeak**: `"tenant-core/cross-tenant-leak"` = `"tenant-core/cross-tenant-leak"`

### defaultFallback

> `readonly` **defaultFallback**: `"tenant-core/default-tenant-fallback"` = `"tenant-core/default-tenant-fallback"`

### unsafeQuery

> `readonly` **unsafeQuery**: `"tenant-core/unsafe-query"` = `"tenant-core/unsafe-query"`
