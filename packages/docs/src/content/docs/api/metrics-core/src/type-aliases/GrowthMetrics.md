---
editUrl: false
next: false
prev: false
title: "GrowthMetrics"
---

> **GrowthMetrics** = `object`

Growth metrics tracking business expansion and sustainability.

## Formula

Quick Ratio = (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)

## Properties

### quickRatio

> **quickRatio**: `number`

New + Expansion / (Churned + Contraction). >1 means growing, <1 means shrinking

***

### revenueCC?

> `optional` **revenueCC**: [`CCResult`](/api/metrics-core/src/type-aliases/ccresult/)

Optional: Revenue-based cohort capacity analysis

***

### userCC?

> `optional` **userCC**: [`CCResult`](/api/metrics-core/src/type-aliases/ccresult/)

Optional: User-based cohort capacity analysis
