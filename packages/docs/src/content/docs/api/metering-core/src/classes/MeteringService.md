---
editUrl: false
next: false
prev: false
title: "MeteringService"
---

Usage Metering 핵심 서비스

## Description

- record(): 사용량 기록 (핵심 메서드)
- getUsage(): 사용량 조회
- Quota 초과 시 QuotaExceededProblem throw 또는 이벤트 발행

## Constructors

### Constructor

> **new MeteringService**(`options`): `MeteringService`

#### Parameters

##### options

[`MeteringServiceOptions`](/api/metering-core/src/type-aliases/meteringserviceoptions/)

#### Returns

`MeteringService`

## Methods

### getUsage()

> **getUsage**(`options`): `Promise`\<`number`\>

사용량 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>

---

### record()

> **record**(`options`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)\>

사용량 기록

#### Parameters

##### options

[`RecordOptions`](/api/metering-core/src/type-aliases/recordoptions/)

#### Returns

`Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)\>

#### Throws

QuotaExceededProblem quota 초과 시 (allowOverQuota=false)

#### Throws

DuplicateRecordProblem 중복 idempotencyKey 시

#### Throws

InvalidMeterProblem meter 없을 시
