---
editUrl: false
next: false
prev: false
title: "MetricsEngine"
---

MetricsEngine - Facade service for all metrics calculations.

## Description

Provides a unified interface for calculating SaaS metrics across multiple domains:
- MRR (Monthly Recurring Revenue)
- Retention (Churn, GRR, NRR)
- Growth (Quick Ratio)
- Carrying Capacity (User CC, Revenue CC)
- Customer Value (LTV, ARPA)

All calculations are delegated to specialized Calculator classes.
This service is designed for dependency injection via TypeDI Container.

## Constructors

### Constructor

> **new MetricsEngine**(`mrrCalculator`, `retentionCalculator`, `growthCalculator`, `ccCalculator`, `ltvCalculator`, `snapshotScheduler`): `MetricsEngine`

#### Parameters

##### mrrCalculator

[`MrrCalculator`](/api/metrics-core/src/classes/mrrcalculator/)

##### retentionCalculator

[`RetentionCalculator`](/api/metrics-core/src/classes/retentioncalculator/)

##### growthCalculator

[`GrowthCalculator`](/api/metrics-core/src/classes/growthcalculator/)

##### ccCalculator

[`CarryingCapacityCalculator`](/api/metrics-core/src/classes/carryingcapacitycalculator/)

##### ltvCalculator

[`LtvCalculator`](/api/metrics-core/src/classes/ltvcalculator/)

##### snapshotScheduler

[`SnapshotScheduler`](/api/metrics-core/src/classes/snapshotscheduler/)

#### Returns

`MetricsEngine`

## Methods

### calculateARPA()

> **calculateARPA**(`period`, `mrr`, `activeCustomers`): `Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

Calculate Average Revenue Per Account (ARPA).

ARPA formula: MRR / Active Customer Count

#### Parameters

##### period

[`Period`](/api/metrics-core/src/type-aliases/period/)

Time period for ARPA calculation

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

### calculateChurn()

> **calculateChurn**(`startingMRR`, `movement`, `type`): `Promise`\<`number` \| `null`\>

#### Parameters

##### startingMRR

`number`

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

##### type

`"revenue"`

#### Returns

`Promise`\<`number` \| `null`\>

***

### calculateGRR()

> **calculateGRR**(`startingMRR`, `movement`): `Promise`\<`number` \| `null`\>

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

`Promise`\<`number` \| `null`\>

GRR as percentage (0-100), or null if starting MRR is zero

***

### calculateLTV()

> **calculateLTV**(`config`): `Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/) \| `null`\>

Calculate Lifetime Value (LTV).

Simple LTV formula: ARPA / Monthly Churn Rate
With margin formula: (ARPA × Gross Margin%) / Monthly Churn Rate

#### Parameters

##### config

[`LtvConfig`](/api/metrics-core/src/type-aliases/ltvconfig/)

LTV calculation configuration

#### Returns

`Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/) \| `null`\>

LTV as Money value, or null if churn rate is 0 (infinite LTV)

***

### calculateMRR()

> **calculateMRR**(`subscriptions`, `planProvider`): `Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

Calculate total Monthly Recurring Revenue from active subscriptions.

#### Parameters

##### subscriptions

[`SubscriptionSnapshot`](/api/metrics-core/src/type-aliases/subscriptionsnapshot/)[]

Active subscriptions to calculate MRR from

##### planProvider

[`PlanProvider`](/api/metrics-core/src/interfaces/planprovider/)

#### Returns

`Promise`\<[`Money`](/api/metrics-core/src/type-aliases/money/)\>

Total MRR as Money value

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

### calculateQuickRatio()

> **calculateQuickRatio**(`movement`): `Promise`\<`number` \| `null`\>

Calculate Quick Ratio for a period.

Quick Ratio measures how much new revenue is coming in compared to revenue leaving.
- >4: Excellent growth
- 2-4: Healthy growth
- 1-2: Moderate growth
- <1: Declining (at risk)

#### Parameters

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

MRR movement data for the period

#### Returns

`Promise`\<`number` \| `null`\>

Quick Ratio, or null if denominator is zero

***

### captureSnapshot()

> **captureSnapshot**(`input`, `date?`, `tenantId?`): `Promise`\<`void`\>

Capture metrics snapshot for a specific date.

#### Parameters

##### input

[`SnapshotInput`](/api/metrics-core/src/type-aliases/snapshotinput/)

Snapshot input data

##### date?

`Date`

Snapshot date (defaults to yesterday)

##### tenantId?

`string`

Optional tenant ID

#### Returns

`Promise`\<`void`\>

***

### getCarryingCapacity()

> **getCarryingCapacity**(`config`): `Promise`\<[`CCResult`](/api/metrics-core/src/type-aliases/ccresult/) \| `null`\>

Get User Carrying Capacity.

#### Parameters

##### config

[`UserCCConfig`](/api/metrics-core/src/type-aliases/userccconfig/)

Configuration for calculation

#### Returns

`Promise`\<[`CCResult`](/api/metrics-core/src/type-aliases/ccresult/) \| `null`\>

User CC result, or null if churn rate is 0 (infinite capacity)

***

### getMRRMovement()

> **getMRRMovement**(`hasPreviousSubscription`, `wasChurned`, `previousAmount`, `newAmount`): [`MRRMovementType`](/api/metrics-core/src/type-aliases/mrrmovementtype/)

Classify MRR movement type based on event and subscription history.

#### Parameters

##### hasPreviousSubscription

`boolean`

Whether customer had a subscription before

##### wasChurned

`boolean`

Whether previous subscription was churned

##### previousAmount

`number` \| `null`

Previous plan amount (if any)

##### newAmount

`number`

New plan amount

#### Returns

[`MRRMovementType`](/api/metrics-core/src/type-aliases/mrrmovementtype/)

MRR movement type

***

### simulateCapacity()

> **simulateCapacity**(`changes`): `Promise`\<[`CCComparisonResult`](/api/metrics-core/src/type-aliases/cccomparisonresult/)\>

Simulate Carrying Capacity with what-if changes.

#### Parameters

##### changes

[`SimulationConfig`](/api/metrics-core/src/type-aliases/simulationconfig/)

Simulation parameters

#### Returns

`Promise`\<[`CCComparisonResult`](/api/metrics-core/src/type-aliases/cccomparisonresult/)\>

Comparison between baseline and simulated CC

#### Example

```ts
// "What if churn decreases by 20%?"
const result = await engine.simulateCapacity({ churnChange: -20 });
```
