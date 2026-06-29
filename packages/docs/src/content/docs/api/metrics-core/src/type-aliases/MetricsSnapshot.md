---
editUrl: false
next: false
prev: false
title: "MetricsSnapshot"
---

> **MetricsSnapshot** = `object`

Metrics snapshot for a specific date.

Represents the aggregated MRR state at a point in time,
used for historical analysis and trend calculation.

## Properties

### activeCustomers

> **activeCustomers**: `number`

Number of active customers contributing to MRR

***

### date

> **date**: `Date`

Snapshot date

***

### movement?

> `optional` **movement?**: [`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

Optional: MRR movement breakdown for this period

***

### totalMRR

> **totalMRR**: [`Money`](/api/metrics-core/src/type-aliases/money/)

Total Monthly Recurring Revenue
