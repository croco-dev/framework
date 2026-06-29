---
editUrl: false
next: false
prev: false
title: "InMemoryHealthScoreStore"
---

## Extends

- [`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/)

## Constructors

### Constructor

> **new InMemoryHealthScoreStore**(): `InMemoryHealthScoreStore`

#### Returns

`InMemoryHealthScoreStore`

#### Inherited from

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`constructor`](/api/customer-health-core/src/classes/healthscorestore/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/)\>

#### Inherited from

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`token`](/api/customer-health-core/src/classes/healthscorestore/#token)

## Methods

### findHistory()

> **findHistory**(`tenantId`, `limit`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

#### Parameters

##### tenantId

`string`

##### limit

`number`

#### Returns

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`findHistory`](/api/customer-health-core/src/classes/healthscorestore/#findhistory)

***

### findHistoryByPeriod()

> **findHistoryByPeriod**(`tenantId`, `_period`, `startDate`, `endDate`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

#### Parameters

##### tenantId

`string`

##### \_period

[`TrendPeriod`](/api/customer-health-core/src/type-aliases/trendperiod/)

##### startDate

`Date`

##### endDate

`Date`

#### Returns

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`findHistoryByPeriod`](/api/customer-health-core/src/classes/healthscorestore/#findhistorybyperiod)

***

### findLatest()

> **findLatest**(`tenantId`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`findLatest`](/api/customer-health-core/src/classes/healthscorestore/#findlatest)

***

### save()

> **save**(`score`): `Promise`\<`void`\>

#### Parameters

##### score

[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`save`](/api/customer-health-core/src/classes/healthscorestore/#save)
