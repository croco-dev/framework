---
editUrl: false
next: false
prev: false
title: "DrizzleHealthScoreStore"
---

건강 점수 이력을 Drizzle 테이블에 저장하는 구현체입니다.

## Extends

- `HealthScoreStore`

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

`HealthScoreStore.constructor`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`HealthScoreStore`\>

#### Inherited from

`HealthScoreStore.token`

## Methods

### findHistory()

> **findHistory**(`tenantId`, `limit`): `Promise`\<`TenantHealthScore`[]\>

테넌트의 건강 점수 이력을 최신순으로 조회합니다.

#### Parameters

##### tenantId

`string`

##### limit

`number`

#### Returns

`Promise`\<`TenantHealthScore`[]\>

#### Overrides

`HealthScoreStore.findHistory`

***

### findHistoryByPeriod()

> **findHistoryByPeriod**(`tenantId`, `_period`, `startDate`, `endDate`): `Promise`\<`TenantHealthScore`[]\>

기간 범위에 포함되는 건강 점수 이력을 조회합니다.

#### Parameters

##### tenantId

`string`

##### \_period

`TrendPeriod`

##### startDate

`Date`

##### endDate

`Date`

#### Returns

`Promise`\<`TenantHealthScore`[]\>

#### Overrides

`HealthScoreStore.findHistoryByPeriod`

***

### findLatest()

> **findLatest**(`tenantId`): `Promise`\<`TenantHealthScore` \| `null`\>

테넌트의 최신 건강 점수를 조회합니다.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`TenantHealthScore` \| `null`\>

#### Overrides

`HealthScoreStore.findLatest`

***

### save()

> **save**(`score`): `Promise`\<`void`\>

계산된 건강 점수를 저장합니다.

#### Parameters

##### score

`TenantHealthScore`

#### Returns

`Promise`\<`void`\>

#### Overrides

`HealthScoreStore.save`
