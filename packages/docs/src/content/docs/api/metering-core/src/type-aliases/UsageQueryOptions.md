---
editUrl: false
next: false
prev: false
title: "UsageQueryOptions"
---

> **UsageQueryOptions** = `object`

Usage 조회 옵션

## Properties

### endDate?

> `optional` **endDate?**: `Date`

Inclusive upper timestamp bound. Must be provided together with startDate.

---

### meterId

> **meterId**: `string`

---

### period

> **period**: [`AggregationPeriod`](/api/metering-core/src/type-aliases/aggregationperiod/)

---

### startDate?

> `optional` **startDate?**: `Date`

Inclusive lower timestamp bound. Must be provided together with endDate.

---

### tenantId

> **tenantId**: `string`
