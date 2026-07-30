---
editUrl: false
next: false
prev: false
title: "EntitlementCheckResult"
---

> **EntitlementCheckResult** = `object`

## Properties

### exceeded?

> `optional` **exceeded?**: `boolean`

---

### featureKey

> **featureKey**: `string`

---

### granted

> **granted**: `boolean`

---

### overagePolicy?

> `optional` **overagePolicy?**: [`OveragePolicy`](/api/entitlements-core/src/type-aliases/overagepolicy/)

---

### planId?

> `optional` **planId?**: `string`

---

### planVersionRef?

> `optional` **planVersionRef?**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

---

### quota?

> `optional` **quota?**: `number`

---

### reason?

> `optional` **reason?**: [`EntitlementFailureReason`](/api/entitlements-core/src/type-aliases/entitlementfailurereason/)

---

### remaining?

> `optional` **remaining?**: `number`

---

### status

> **status**: [`EntitlementCheckStatus`](/api/entitlements-core/src/type-aliases/entitlementcheckstatus/)

---

### trace?

> `optional` **trace?**: [`PolicyDecisionTrace`](/api/access-core/src/type-aliases/policydecisiontrace/)

---

### type

> **type**: [`EntitlementType`](/api/entitlements-core/src/type-aliases/entitlementtype/)

---

### usage?

> `optional` **usage?**: `number`

---

### value?

> `optional` **value?**: `number`
