---
editUrl: false
next: false
prev: false
title: "AdminEntitlementRow"
---

> **AdminEntitlementRow** = `object`

## Properties

### exceeded?

> `readonly` `optional` **exceeded?**: `boolean`

---

### featureKey

> `readonly` **featureKey**: `string`

---

### granted

> `readonly` **granted**: `boolean`

---

### label?

> `readonly` `optional` **label?**: `string`

---

### mutability

> `readonly` **mutability**: `"editable"`

---

### overagePolicy?

> `readonly` `optional` **overagePolicy?**: [`OveragePolicy`](/api/entitlements-core/src/type-aliases/overagepolicy/)

---

### problem?

> `readonly` `optional` **problem?**: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### quota?

> `readonly` `optional` **quota?**: `number`

---

### reason?

> `readonly` `optional` **reason?**: `string`

---

### remaining?

> `readonly` `optional` **remaining?**: `number`

---

### source

> `readonly` **source**: `"croco"`

---

### state

> `readonly` **state**: `"active"` \| `"missing"` \| `"denied"` \| `"over-quota"` \| `"warn"` \| `"allowed-overage"`

---

### type

> `readonly` **type**: [`EntitlementType`](/api/entitlements-core/src/type-aliases/entitlementtype/)

---

### usage?

> `readonly` `optional` **usage?**: `number`

---

### value?

> `readonly` `optional` **value?**: `number`
