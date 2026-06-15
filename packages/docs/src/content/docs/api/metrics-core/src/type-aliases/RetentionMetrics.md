---
editUrl: false
next: false
prev: false
title: "RetentionMetrics"
---

> **RetentionMetrics** = `object`

Retention metrics measuring customer and revenue retention.

## Formula

Logo Churn Rate = (Churned Customers / Starting Customers) * 100

## Formula

Revenue Churn Rate = (Churned MRR / Starting MRR) * 100

## Formula

GRR = ((Starting MRR - Churned MRR - Contraction MRR) / Starting MRR) * 100

## Formula

NRR = ((Starting MRR + Expansion MRR - Churned MRR - Contraction MRR) / Starting MRR) * 100

## Properties

### grr

> **grr**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Gross Revenue Retention - retention excluding expansion (≤100)

***

### logoChurn

> **logoChurn**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Customer logo churn rate (0-100)

***

### nrr

> **nrr**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Net Revenue Retention - retention including expansion (>100 possible)

***

### revenueChurn

> **revenueChurn**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Revenue churn rate (0-100)
