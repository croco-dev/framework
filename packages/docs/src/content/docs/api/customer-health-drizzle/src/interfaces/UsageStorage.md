---
editUrl: false
next: false
prev: false
title: "UsageStorage"
---

사용량 데이터를 제공하는 저장소 인터페이스입니다.

## Methods

### getUsage()

> **getUsage**(`tenantId`, `periodStart`, `periodEnd`): `Promise`\<[`UsageData`](/api/customer-health-drizzle/src/type-aliases/usagedata/)\>

#### Parameters

##### tenantId

`string`

##### periodStart

`Date`

##### periodEnd

`Date`

#### Returns

`Promise`\<[`UsageData`](/api/customer-health-drizzle/src/type-aliases/usagedata/)\>
