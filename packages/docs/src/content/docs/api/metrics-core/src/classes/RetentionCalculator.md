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

> **calculateChurn**(`startingMRR`, `movement`, `_type`): `Promise`\<`number` \| `null`\>

#### Parameters

##### startingMRR

`number`

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

##### \_type

`"revenue"`

#### Returns

`Promise`\<`number` \| `null`\>

***

### calculateGRR()

> **calculateGRR**(`startingMRR`, `movement`): `Promise`\<`number` \| `null`\>

Calculate Gross Revenue Retention (GRR) for a period.

Formula: max(0, min(100, ((Starting MRR - Churned MRR - Contraction MRR) / Starting MRR) * 100))

#### Parameters

##### startingMRR

`number`

MRR at the start of the period

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

MRR movement data with finite, non-negative churn and contraction amounts

#### Returns

`Promise`\<`number` \| `null`\>

GRR as percentage (0-100), or null if starting MRR is zero

#### Throws

InvalidRetentionMovementProblem when churn or contraction is negative or non-finite

***

### calculateLogoChurn()

> **calculateLogoChurn**(`startingCustomers`, `endingCustomers`): `Promise`\<`number` \| `null`\>

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

`Promise`\<`number` \| `null`\>

Logo Churn as percentage, or null if starting customers is zero

***

### calculateNRR()

> **calculateNRR**(`startingMRR`, `movement`): `Promise`\<`number` \| `null`\>

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

`Promise`\<`number` \| `null`\>

NRR as percentage (can be >100%), or null if starting MRR is zero

***

### calculateRetention()

> **calculateRetention**(`startingMRR`, `movement`, `startingCustomers?`, `endingCustomers?`): `Promise`\<\{ `grr`: `number` \| `null`; `logoChurn`: `number` \| `null`; `nrr`: `number` \| `null`; `revenueChurn`: `number` \| `null`; \}\>

Calculate all retention metrics at once.

#### Parameters

##### startingMRR

`number`

MRR at the start of the period

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

MRR movement data with finite, non-negative churn and contraction amounts

##### startingCustomers?

`number`

Number of customers at start (optional, for logo churn)

##### endingCustomers?

`number`

Number of customers at end (optional, for logo churn)

#### Returns

`Promise`\<\{ `grr`: `number` \| `null`; `logoChurn`: `number` \| `null`; `nrr`: `number` \| `null`; `revenueChurn`: `number` \| `null`; \}\>

Complete retention metrics

#### Throws

InvalidRetentionMovementProblem when churn or contraction is negative or non-finite
