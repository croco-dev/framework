---
editUrl: false
next: false
prev: false
title: "HealthScoreStore"
---

## Extended by

- [`InMemoryHealthScoreStore`](/api/customer-health-core/src/classes/inmemoryhealthscorestore/)
- [`DrizzleHealthScoreStore`](/api/customer-health-drizzle/src/classes/drizzlehealthscorestore/)

## Constructors

### Constructor

> **new HealthScoreStore**(): `HealthScoreStore`

#### Returns

`HealthScoreStore`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`HealthScoreStore`\>

## Methods

### findHistory()

> `abstract` **findHistory**(`tenantId`, `limit`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

#### Parameters

##### tenantId

`string`

##### limit

`number`

#### Returns

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

***

### findHistoryByPeriod()

> `abstract` **findHistoryByPeriod**(`tenantId`, `period`, `startDate`, `endDate`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

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

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

***

### findLatest()

> `abstract` **findLatest**(`tenantId`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`\>

***

### save()

> `abstract` **save**(`score`): `Promise`\<`void`\>

#### Parameters

##### score

[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)

#### Returns

`Promise`\<`void`\>
