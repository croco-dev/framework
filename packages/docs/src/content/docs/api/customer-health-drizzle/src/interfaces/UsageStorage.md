---
editUrl: false
next: false
prev: false
title: "UsageStorage"
---

사용량 데이터를 제공하는 저장소 인터페이스입니다.

조회 구간은 UTC 기준 `[periodStartInclusive, periodEndExclusive)` 반개방 구간입니다.

## Methods

### getUsage()

> **getUsage**(`tenantId`, `periodStartInclusive`, `periodEndExclusive`): `Promise`\<[`UsageData`](/api/customer-health-drizzle/src/type-aliases/usagedata/)\>

#### Parameters

##### tenantId

`string`

##### periodStartInclusive

`Date`

##### periodEndExclusive

`Date`

#### Returns

`Promise`\<[`UsageData`](/api/customer-health-drizzle/src/type-aliases/usagedata/)\>
