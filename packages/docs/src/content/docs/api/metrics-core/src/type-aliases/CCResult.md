---
editUrl: false
next: false
prev: false
title: "CCResult"
---

> **CCResult** = `object`

Carrying capacity result for user and revenue planning.

## Formula

Headroom % = ((Capacity - Current) / Capacity) \* 100

## Properties

### capacity

> **capacity**: `number`

Maximum capacity (users or MRR)

---

### current

> **current**: `number`

Current count (users or MRR)

---

### dailyChurnRate

> **dailyChurnRate**: `number`

NRR-derived churn per day. Revenue capacity reports monthly churn divided by 30.

---

### dailyInflow

> **dailyInflow**: `number`

Daily new inflow rate (users/day or MRR/day)

---

### headroom

> **headroom**: `number`

Remaining capacity (capacity - current)

---

### headroomPercent

> **headroomPercent**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Headroom as percentage of capacity (0-100)
