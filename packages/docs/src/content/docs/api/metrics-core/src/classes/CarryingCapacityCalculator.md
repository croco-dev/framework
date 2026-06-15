---
editUrl: false
next: false
prev: false
title: "CarryingCapacityCalculator"
---

Calculator for Carrying Capacity (User CC & Revenue CC).

## Description

Carrying Capacity measures the maximum sustainable scale given current inflow and churn rates.

User CC: Maximum users sustainable = Daily New Users / Daily Churn Rate
Revenue CC: Maximum MRR sustainable = Monthly New MRR / (1 - NRR)

## Example

```typescript
const calculator = new CarryingCapacityCalculator(userProvider, metricsRepo);

// Calculate User CC (e.g., 1000 daily new users, 2% daily churn → 50,000 capacity)
const userCC = await calculator.calculateUserCC({ lookbackDays: 30 });

// Simulate: "What if we reduce churn by 20%?"
const simulation = await calculator.simulate({ churnChange: -20 });
```

## Constructors

### Constructor

> **new CarryingCapacityCalculator**(`userProvider`, `metricsRepository`): `CarryingCapacityCalculator`

#### Parameters

##### userProvider

[`ActiveUserProvider`](/api/metrics-core/src/interfaces/activeuserprovider/)

##### metricsRepository

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/)

#### Returns

`CarryingCapacityCalculator`

## Methods

### calculateRevenueCC()

> **calculateRevenueCC**(`config`): `Promise`\<[`CCResult`](/api/metrics-core/src/type-aliases/ccresult/)\>

Calculate Revenue Carrying Capacity.

#### Parameters

##### config

[`RevenueCCConfig`](/api/metrics-core/src/type-aliases/revenueccconfig/)

#### Returns

`Promise`\<[`CCResult`](/api/metrics-core/src/type-aliases/ccresult/)\>

Revenue CC result, or null if NRR = 100% (infinite capacity)

#### Formula

Capacity = Monthly New MRR / (1 - NRR)

***

### calculateUserCC()

> **calculateUserCC**(`config`): `Promise`\<[`CCResult`](/api/metrics-core/src/type-aliases/ccresult/)\>

Calculate User Carrying Capacity.

#### Parameters

##### config

[`UserCCConfig`](/api/metrics-core/src/type-aliases/userccconfig/)

Configuration for calculation

#### Returns

`Promise`\<[`CCResult`](/api/metrics-core/src/type-aliases/ccresult/)\>

User CC result, or null if churn rate is 0 (infinite capacity)

#### Formula

Capacity = Daily New Users / Daily Churn Rate

#### Formula

Daily Churn Rate = (1 - (NRR / 100)) ^ (1/30) (derived from monthly NRR)

***

### simulate()

> **simulate**(`changes`): `Promise`\<[`CCComparisonResult`](/api/metrics-core/src/type-aliases/cccomparisonresult/)\>

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
const result = await calculator.simulate({ churnChange: -20 });
```
