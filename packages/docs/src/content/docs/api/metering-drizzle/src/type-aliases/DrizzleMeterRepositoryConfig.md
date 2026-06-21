---
editUrl: false
next: false
prev: false
title: "DrizzleMeterRepositoryConfig"
---

> **DrizzleMeterRepositoryConfig** = `object`

저장소 초기화에 필요한 스키마와 직렬화 설정입니다.

## Properties

### deserializeJson()?

> `optional` **deserializeJson**: (`value`) => `unknown`

#### Parameters

##### value

`string`

#### Returns

`unknown`

***

### meterSchema

> **meterSchema**: [`MeterTable`](/api/metering-drizzle/src/type-aliases/metertable/)

***

### meterTable

> **meterTable**: `unknown`

***

### serializeJson()?

> `optional` **serializeJson**: (`value`) => `string`

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### usageRecordSchema

> **usageRecordSchema**: [`UsageRecordTable`](/api/metering-drizzle/src/type-aliases/usagerecordtable/)

***

### usageRecordTable

> **usageRecordTable**: `unknown`
