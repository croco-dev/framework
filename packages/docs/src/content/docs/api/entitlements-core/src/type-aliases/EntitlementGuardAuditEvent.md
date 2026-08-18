---
editUrl: false
next: false
prev: false
title: "EntitlementGuardAuditEvent"
---

> **EntitlementGuardAuditEvent** = `object`

## Properties

### feature

> `readonly` **feature**: `string`

---

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

---

### problemCode?

> `readonly` `optional` **problemCode?**: `string`

---

### reason?

> `readonly` `optional` **reason?**: `string`

---

### resource?

> `readonly` `optional` **resource?**: [`EntitlementGuardAuditResource`](/api/entitlements-core/src/type-aliases/entitlementguardauditresource/)

---

### route?

> `readonly` `optional` **route?**: [`EntitlementGuardAuditRoute`](/api/entitlements-core/src/type-aliases/entitlementguardauditroute/)

---

### status

> `readonly` **status**: [`EntitlementCheckStatus`](/api/entitlements-core/src/type-aliases/entitlementcheckstatus/)

---

### tenantId

> `readonly` **tenantId**: `string`

---

### type

> `readonly` **type**: `"entitlement.guard.allowed"` \| `"entitlement.guard.denied"`

---

### userId?

> `readonly` `optional` **userId?**: `string`
