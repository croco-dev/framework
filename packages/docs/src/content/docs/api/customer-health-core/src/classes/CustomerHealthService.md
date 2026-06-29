---
editUrl: false
next: false
prev: false
title: "CustomerHealthService"
---

## Constructors

### Constructor

> **new CustomerHealthService**(`signalRegistry`, `store`, `calculator`): `CustomerHealthService`

#### Parameters

##### signalRegistry

[`HealthSignalRegistry`](/api/customer-health-core/src/classes/healthsignalregistry/)

##### store

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/)

##### calculator

[`HealthScoreCalculator`](/api/customer-health-core/src/classes/healthscorecalculator/)

#### Returns

`CustomerHealthService`

## Methods

### calculateAndStore()

> **calculateAndStore**(`tenantId`, `profile`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)\>

#### Parameters

##### tenantId

`string`

##### profile

[`HealthScoreProfile`](/api/customer-health-core/src/type-aliases/healthscoreprofile/)

#### Returns

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)\>

***

### getLatest()

> **getLatest**(`tenantId`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`\>

***

### getTrend()

> **getTrend**(`tenantId`, `days`): `Promise`\<\{ `changePercentage`: `number`; `trend`: [`HealthTrend`](/api/customer-health-core/src/type-aliases/healthtrend/); \} \| `null`\>

#### Parameters

##### tenantId

`string`

##### days

`number`

#### Returns

`Promise`\<\{ `changePercentage`: `number`; `trend`: [`HealthTrend`](/api/customer-health-core/src/type-aliases/healthtrend/); \} \| `null`\>
