---
editUrl: false
next: false
prev: false
title: "TrendAnalyzer"
---

## Constructors

### Constructor

> **new TrendAnalyzer**(): `TrendAnalyzer`

#### Returns

`TrendAnalyzer`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`TrendAnalyzer`\>

## Methods

### analyzeTrend()

> `abstract` **analyzeTrend**(`tenantId`, `period`, `startDate`, `endDate`): `Promise`\<[`HealthTrendAnalysis`](/api/customer-health-core/src/type-aliases/healthtrendanalysis/)\>

#### Parameters

##### tenantId

`string`

##### period

[`TrendPeriod`](/api/customer-health-core/src/type-aliases/trendperiod/)

##### startDate

`Date`

##### endDate

`Date`

#### Returns

`Promise`\<[`HealthTrendAnalysis`](/api/customer-health-core/src/type-aliases/healthtrendanalysis/)\>
