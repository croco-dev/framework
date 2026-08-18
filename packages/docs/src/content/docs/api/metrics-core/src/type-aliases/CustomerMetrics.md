---
editUrl: false
next: false
prev: false
title: "CustomerMetrics"
---

> **CustomerMetrics** = `object`

Customer value metrics.

## Formula

LTV = ARPA / Monthly Churn Rate

## Formula

ARPA = MRR / Active Customer Count

## Properties

### arpa

> **arpa**: [`Money`](/api/metrics-core/src/type-aliases/money/)

Average Revenue Per Account

***

### ltv

> **ltv**: [`Money`](/api/metrics-core/src/type-aliases/money/) \| `null`

Lifetime Value - null if churn rate is 0 (infinite LTV)
