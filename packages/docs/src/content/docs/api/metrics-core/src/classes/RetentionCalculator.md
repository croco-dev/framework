---
editUrl: false
next: false
prev: false
title: "RetentionCalculator"
---

churn, GRR, NRR, Logo Churn 등 리텐션 지표를 계산하는 계산기입니다.

## Constructors

### Constructor

> **new RetentionCalculator**(): `RetentionCalculator`

#### Returns

`RetentionCalculator`

## Methods

### calculateChurn()

> **calculateChurn**(`startingMRR`, `movement`, `_type`): `Promise`\<`number`\>

#### Parameters

##### startingMRR

`number`

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

##### \_type

`"revenue"`

#### Returns

`Promise`\<`number`\>

***

### calculateGRR()

> **calculateGRR**(`startingMRR`, `movement`): `Promise`\<`number`\>

Calculate Gross Revenue Retention (GRR) for a period.

Formula: (Starting MRR - Churned MRR - Contraction MRR) / Starting MRR

#### Parameters

##### startingMRR

`number`

MRR at the start of the period

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

MRR movement data for the period

#### Returns

`Promise`\<`number`\>

GRR as percentage (0-100), or null if starting MRR is zero

***

### calculateLogoChurn()

> **calculateLogoChurn**(`startingCustomers`, `endingCustomers`): `Promise`\<`number`\>

Calculate Logo Churn Rate (customer churn rate based on number of customers).

Formula: (Starting Customers - Ending Customers) / Starting Customers * 100

#### Parameters

##### startingCustomers

`number`

Number of customers at start of period

##### endingCustomers

`number`

Number of customers at end of period

#### Returns

`Promise`\<`number`\>

Logo Churn as percentage, or null if starting customers is zero

***

### calculateNRR()

> **calculateNRR**(`startingMRR`, `movement`): `Promise`\<`number`\>

Calculate Net Revenue Retention (NRR) for a period.

Formula: (Starting MRR + Expansion MRR - Churned MRR - Contraction MRR) / Starting MRR

#### Parameters

##### startingMRR

`number`

MRR at the start of the period

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

MRR movement data for the period

#### Returns

`Promise`\<`number`\>

NRR as percentage (can be >100%), or null if starting MRR is zero

***

### calculateRetention()

> **calculateRetention**(`startingMRR`, `movement`, `startingCustomers?`, `endingCustomers?`): `Promise`\<\{ `grr`: `number`; `logoChurn`: `number`; `nrr`: `number`; `revenueChurn`: `number`; \}\>

Calculate all retention metrics at once.

#### Parameters

##### startingMRR

`number`

MRR at the start of the period

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

MRR movement data for the period

##### startingCustomers?

`number`

Number of customers at start (optional, for logo churn)

##### endingCustomers?

`number`

Number of customers at end (optional, for logo churn)

#### Returns

`Promise`\<\{ `grr`: `number`; `logoChurn`: `number`; `nrr`: `number`; `revenueChurn`: `number`; \}\>

Complete retention metrics
