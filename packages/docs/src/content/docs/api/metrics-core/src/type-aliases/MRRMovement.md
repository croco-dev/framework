---
editUrl: false
next: false
prev: false
title: "MRRMovement"
---

> **MRRMovement** = `object`

Monthly Recurring Revenue (MRR) movement breakdown.

## Formula

Net MRR = New + Expansion - Contraction - Churned + Reactivation

## Properties

### churned

> **churned**: [`Money`](/api/metrics-core/src/type-aliases/money/)

MRR from customers who churned

***

### contraction

> **contraction**: [`Money`](/api/metrics-core/src/type-aliases/money/)

MRR from existing customers downgrading/reducing seats

***

### expansion

> **expansion**: [`Money`](/api/metrics-core/src/type-aliases/money/)

MRR from existing customers upgrading/adding seats

***

### net

> **net**: [`Money`](/api/metrics-core/src/type-aliases/money/)

Net change in MRR (New + Expansion - Contraction - Churned + Reactivation)

***

### new

> **new**: [`Money`](/api/metrics-core/src/type-aliases/money/)

MRR from new customers

***

### reactivation

> **reactivation**: [`Money`](/api/metrics-core/src/type-aliases/money/)

MRR from previously churned customers who returned
