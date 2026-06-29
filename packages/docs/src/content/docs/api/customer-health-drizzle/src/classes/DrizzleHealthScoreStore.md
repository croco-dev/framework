---
editUrl: false
next: false
prev: false
title: "DrizzleHealthScoreStore"
---

건강 점수 이력을 Drizzle 테이블에 저장하는 구현체입니다.

## Extends

- [`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/)

## Constructors

### Constructor

> **new DrizzleHealthScoreStore**(`db`): `DrizzleHealthScoreStore`

Drizzle 클라이언트를 받아 저장소를 초기화합니다.

#### Parameters

##### db

[`DrizzleHealthClient`](/api/customer-health-drizzle/src/type-aliases/drizzlehealthclient/)

#### Returns

`DrizzleHealthScoreStore`

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`constructor`](/api/customer-health-core/src/classes/healthscorestore/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/)\>

#### Inherited from

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`token`](/api/customer-health-core/src/classes/healthscorestore/#token)

## Methods

### findHistory()

> **findHistory**(`tenantId`, `limit`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)[]\>

테넌트의 건강 점수 이력을 최신순으로 조회합니다.

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

기간 범위에 포함되는 건강 점수 이력을 조회합니다.

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

테넌트의 최신 건강 점수를 조회합니다.

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

계산된 건강 점수를 저장합니다.

#### Parameters

##### score

[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`save`](/api/customer-health-core/src/classes/healthscorestore/#save)
