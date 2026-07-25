---
editUrl: false
next: false
prev: false
title: "RetentionMetrics"
---

> **RetentionMetrics** = `object`

Retention metrics measuring customer and revenue retention.

## Logo churn formula

Logo Churn Rate = (Churned Customers / Starting Customers) \* 100

## Revenue churn formula

Revenue Churn Rate = (Churned MRR / Starting MRR) \* 100

## Gross revenue retention formula

GRR = max(0, min(100, ((Starting MRR - Churned MRR - Contraction MRR) / Starting MRR) \* 100))

`RetentionCalculator.calculateGRR` returns `null` when Starting MRR is zero.
`TimescaleMetricsStore.getRetentionMetrics` represents that unavailable GRR as 100.

## Net revenue retention formula

NRR = ((Starting MRR + Expansion MRR - Churned MRR - Contraction MRR) / Starting MRR) \* 100

## Properties

### grr

> **grr**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Gross Revenue Retention - retention excluding expansion (0-100)

---

### logoChurn

> **logoChurn**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Customer logo churn rate (0-100)

---

### nrr

> **nrr**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Net Revenue Retention - retention including expansion (>100 possible)

---

### revenueChurn

> **revenueChurn**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)

Revenue churn rate (non-negative; may exceed 100 when churned MRR exceeds starting MRR)
