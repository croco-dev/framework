---
editUrl: false
next: false
prev: false
title: "UsageAggregator"
---

Usage 배치 집계 및 DB 저장

## Description

Redis의 실시간 Usage 데이터를 주기적으로 DB에 영구 저장합니다.

- Lambda 환경에서는 즉시 flush하므로 배치 집계는 선택적
- 장기 보관 및 분석을 위한 DB 저장
- 현재 UTC 청구 주기의 기록은 quota와 조회를 위해 Redis에 유지하고, 닫힌 주기만 저장 후 삭제

## Constructors

### Constructor

> **new UsageAggregator**(`options`): `UsageAggregator`

#### Parameters

##### options

[`UsageAggregatorOptions`](/api/metering-core/src/type-aliases/usageaggregatoroptions/)

#### Returns

`UsageAggregator`

## Methods

### flushAllForTenant()

> **flushAllForTenant**(`tenantId`): `Promise`\<[`FlushResult`](/api/metering-core/src/type-aliases/flushresult/)\>

테넌트의 모든 Meter에 대해 flush 수행

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`FlushResult`](/api/metering-core/src/type-aliases/flushresult/)\>

---

### flushUsageToDB()

> **flushUsageToDB**(`tenantId`, `meterId`, `period?`, `range?`): `Promise`\<[`FlushResult`](/api/metering-core/src/type-aliases/flushresult/)\>

Redis에서 Usage 레코드를 가져와 DB에 저장

#### Parameters

##### tenantId

`string`

테넌트 ID

##### meterId

`string`

Meter ID

##### period?

[`AggregationPeriod`](/api/metering-core/src/type-aliases/aggregationperiod/) = `"billing_cycle"`

집계 기간

##### range?

이전 청구 주기 등 저장할 기간의 양 끝 (포함)

###### endDate

`Date`

###### startDate

`Date`

#### Returns

`Promise`\<[`FlushResult`](/api/metering-core/src/type-aliases/flushresult/)\>

저장된 레코드 수

---

### getAggregatedUsage()

> **getAggregatedUsage**(`options`): `Promise`\<`number`\>

특정 기간의 집계된 Usage 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>
