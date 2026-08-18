---
editUrl: false
next: false
prev: false
title: "CCComparisonResult"
---

> **CCComparisonResult** = `object`

Comparison result for carrying capacity simulation (what-if analysis).

Compares baseline CC with simulated CC after applying changes
(e.g., churn rate reduction, inflow increase).

## Properties

### baseline

> **baseline**: [`CCResult`](/api/metrics-core/src/type-aliases/ccresult/)

Baseline carrying capacity before simulation

---

### capacityDelta

> **capacityDelta**: `number`

Capacity change (simulated - baseline)

---

### headroomDelta

> **headroomDelta**: `number`

Headroom change (simulated - baseline)

---

### headroomPercentDelta

> **headroomPercentDelta**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Headroom percent change (simulated - baseline)

---

### simulated

> **simulated**: [`CCResult`](/api/metrics-core/src/type-aliases/ccresult/)

Simulated carrying capacity after applying changes
