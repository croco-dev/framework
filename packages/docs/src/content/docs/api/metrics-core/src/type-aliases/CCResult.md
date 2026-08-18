---
editUrl: false
next: false
prev: false
title: "CCResult"
---

> **CCResult** = `object`

Cohort Capacity result for user and revenue capacity planning.

## Formula

Headroom % = ((Capacity - Current) / Capacity) \* 100

## Formula

Daily Churn Rate = 1 - NRR (monthly)

## Formula

Daily Inflow = New MRR per day (for revenue) or New Users per day (for users)

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

Daily churn rate (0-1, derived from NRR)

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
