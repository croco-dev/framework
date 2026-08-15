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

---

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

---

### findLatest()

> **findLatest**(`tenantId`): `Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`findLatest`](/api/customer-health-core/src/classes/healthscorestore/#findlatest)

---

### listPendingEventIntents()

> **listPendingEventIntents**(`tenantId`, `limit?`): `Promise`\<readonly [`HealthTransitionEventIntent`](/api/customer-health-core/src/type-aliases/healthtransitioneventintent/)[]\>

#### Parameters

##### tenantId

`string`

##### limit?

`number` = `100`

#### Returns

`Promise`\<readonly [`HealthTransitionEventIntent`](/api/customer-health-core/src/type-aliases/healthtransitioneventintent/)[]\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`listPendingEventIntents`](/api/customer-health-core/src/classes/healthscorestore/#listpendingeventintents)

---

### markEventIntentPublished()

> **markEventIntentPublished**(`eventId`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`markEventIntentPublished`](/api/customer-health-core/src/classes/healthscorestore/#markeventintentpublished)

---

### saveTransition()

> **saveTransition**(`score`, `previous`, `eventIntents`): `Promise`\<\{ `committed`: `true`; \} \| \{ `committed`: `false`; `latest`: [`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`; \}\>

#### Parameters

##### score

[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)

##### previous

[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`

##### eventIntents

readonly [`HealthTransitionEventIntent`](/api/customer-health-core/src/type-aliases/healthtransitioneventintent/)[]

#### Returns

`Promise`\<\{ `committed`: `true`; \} \| \{ `committed`: `false`; `latest`: [`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/) \| `null`; \}\>

#### Overrides

[`HealthScoreStore`](/api/customer-health-core/src/classes/healthscorestore/).[`saveTransition`](/api/customer-health-core/src/classes/healthscorestore/#savetransition)
