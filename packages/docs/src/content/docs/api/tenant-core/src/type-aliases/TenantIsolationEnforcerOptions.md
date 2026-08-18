---
editUrl: false
next: false
prev: false
title: "TenantIsolationEnforcerOptions"
---

> **TenantIsolationEnforcerOptions** = `object`

## Properties

### auditSink?

> `readonly` `optional` **auditSink?**: [`TenantIsolationAuditSink`](/api/tenant-core/src/type-aliases/tenantisolationauditsink/)

***

### contextProvider?

> `readonly` `optional` **contextProvider?**: [`TenantContextProvider`](/api/tenant-core/src/type-aliases/tenantcontextprovider/)

***

### defaultTenantIds?

> `readonly` `optional` **defaultTenantIds?**: readonly `string`[]

***

### observabilityFailureMode?

> `readonly` `optional` **observabilityFailureMode?**: [`TenantIsolationObservabilityFailureMode`](/api/tenant-core/src/type-aliases/tenantisolationobservabilityfailuremode/)

Defaults to best-effort. Denials always preserve their original Tenant Problem.

***

### policyDecisionTraceSink?

> `readonly` `optional` **policyDecisionTraceSink?**: [`PolicyDecisionTraceSink`](/api/access-core/src/type-aliases/policydecisiontracesink/)
