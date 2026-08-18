---
editUrl: false
next: false
prev: false
title: "TenantIsolationAuditEvent"
---

> **TenantIsolationAuditEvent** = `object`

## Properties

### decisionId?

> `readonly` `optional` **decisionId?**: `string`

---

### kind

> `readonly` **kind**: [`TenantOperationKind`](/api/tenant-core/src/type-aliases/tenantoperationkind/)

---

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `unknown`\>

---

### operation

> `readonly` **operation**: `string`

---

### policyDecisionTrace?

> `readonly` `optional` **policyDecisionTrace?**: [`PolicyDecisionTrace`](/api/access-core/src/type-aliases/policydecisiontrace/)

---

### problemCode?

> `readonly` `optional` **problemCode?**: `string`

---

### reason?

> `readonly` `optional` **reason?**: `string`

---

### resource?

> `readonly` `optional` **resource?**: `string`

---

### tenantId

> `readonly` **tenantId**: `string` \| `null`

---

### type

> `readonly` **type**: `"tenant-isolation.allowed"` \| `"tenant-isolation.bypassed"` \| `"tenant-isolation.denied"` \| `"tenant-isolation.leak-detected"`
