---
editUrl: false
next: false
prev: false
title: "LtvCalculator"
---

Calculator for Customer Lifetime Value (LTV) and Average Revenue Per Account (ARPA).

LTV measures the total revenue a business can expect from a single customer account.
ARPA measures the average revenue generated per account.

## Constructors

### Constructor

> **new LtvCalculator**(): `LtvCalculator`

#### Returns

`LtvCalculator`

## Methods

### calculateARPA()

> **calculateARPA**(`_period`, `mrr`, `activeCustomers`): `Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

Calculate Average Revenue Per Account (ARPA).

ARPA formula: MRR / Active Customer Count

#### Parameters

##### \_period

[`Period`](/api/metrics-core/src/type-aliases/period/)

##### mrr

[`Money`](/api/metrics-core/src/type-aliases/money/)

Monthly Recurring Revenue

##### activeCustomers

`number`

Number of active customers

#### Returns

`Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

ARPA as Money value

***

### calculateLTV()

> **calculateLTV**(`config`): `Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

Calculate Lifetime Value (LTV).

Simple LTV formula: ARPA / Monthly Churn Rate
With margin formula: (ARPA × Gross Margin%) / Monthly Churn Rate

#### Parameters

##### config

[`LtvConfig`](/api/metrics-core/src/type-aliases/ltvconfig/)

LTV calculation configuration

#### Returns

`Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

LTV as Money value, or null if churn rate is 0 (infinite LTV)
