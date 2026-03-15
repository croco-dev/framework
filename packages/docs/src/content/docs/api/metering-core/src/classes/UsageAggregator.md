---
editUrl: false
next: false
prev: false
title: "UsageAggregator"
---

Defined in: [packages/metering-core/src/libs/UsageAggregator.ts:18](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageAggregator.ts#L18)

Usage 배치 집계 및 DB 저장

## Description

Redis의 실시간 Usage 데이터를 주기적으로 DB에 영구 저장합니다.
- Lambda 환경에서는 즉시 flush하므로 배치 집계는 선택적
- 장기 보관 및 분석을 위한 DB 저장

## Constructors

### Constructor

> **new UsageAggregator**(`options`): `UsageAggregator`

Defined in: [packages/metering-core/src/libs/UsageAggregator.ts:22](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageAggregator.ts#L22)

#### Parameters

##### options

[`UsageAggregatorOptions`](/api/metering-core/src/type-aliases/usageaggregatoroptions/)

#### Returns

`UsageAggregator`

## Methods

### flushAllForTenant()

> **flushAllForTenant**(`tenantId`): `Promise`\<[`FlushResult`](/api/metering-core/src/type-aliases/flushresult/)\>

Defined in: [packages/metering-core/src/libs/UsageAggregator.ts:64](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageAggregator.ts#L64)

테넌트의 모든 Meter에 대해 flush 수행

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`FlushResult`](/api/metering-core/src/type-aliases/flushresult/)\>

***

### flushUsageToDB()

> **flushUsageToDB**(`tenantId`, `meterId`, `period?`): `Promise`\<[`FlushResult`](/api/metering-core/src/type-aliases/flushresult/)\>

Defined in: [packages/metering-core/src/libs/UsageAggregator.ts:35](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageAggregator.ts#L35)

Redis에서 Usage 레코드를 가져와 DB에 저장

#### Parameters

##### tenantId

`string`

테넌트 ID

##### meterId

`string`

Meter ID

##### period?

[`AggregationPeriod`](/api/metering-core/src/type-aliases/aggregationperiod/) = `'billing_cycle'`

집계 기간

#### Returns

`Promise`\<[`FlushResult`](/api/metering-core/src/type-aliases/flushresult/)\>

저장된 레코드 수

***

### getAggregatedUsage()

> **getAggregatedUsage**(`options`): `Promise`\<`number`\>

Defined in: [packages/metering-core/src/libs/UsageAggregator.ts:79](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageAggregator.ts#L79)

특정 기간의 집계된 Usage 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>
