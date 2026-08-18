---
editUrl: false
next: false
prev: false
title: "CreditOperationsReservation"
---

> **CreditOperationsReservation** = `object`

## Properties

### allocations

> `readonly` **allocations**: readonly [`CreditOperationsAllocation`](/api/admin-core/src/type-aliases/creditoperationsallocation/)[]

---

### amount

> `readonly` **amount**: `string`

---

### createdAt

> `readonly` **createdAt**: `Date`

---

### id

> `readonly` **id**: `string`

---

### meterKey?

> `readonly` `optional` **meterKey?**: `string`

---

### release?

> `readonly` `optional` **release?**: `object`

#### allowed

> `readonly` **allowed**: `boolean`

#### reason

> `readonly` **reason**: `string`

---

### settledAt?

> `readonly` `optional` **settledAt?**: `Date`

---

### status

> `readonly` **status**: `"active"` \| `"committed"` \| `"released"`
