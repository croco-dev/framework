---
editUrl: false
next: false
prev: false
title: "MeteringService"
---

Defined in: [packages/metering-core/src/libs/MeteringService.ts:28](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L28)

Usage Metering 핵심 서비스

## Description

- record(): 사용량 기록 (핵심 메서드)
- getUsage(): 사용량 조회
- Quota 초과 시 QuotaExceededProblem throw 또는 이벤트 발행

## Constructors

### Constructor

> **new MeteringService**(`options`): `MeteringService`

Defined in: [packages/metering-core/src/libs/MeteringService.ts:35](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L35)

#### Parameters

##### options

[`MeteringServiceOptions`](/api/metering-core/src/type-aliases/meteringserviceoptions/)

#### Returns

`MeteringService`

## Methods

### getUsage()

> **getUsage**(`options`): `Promise`\<`number`\>

Defined in: [packages/metering-core/src/libs/MeteringService.ts:118](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L118)

사용량 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>

***

### record()

> **record**(`options`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)\>

Defined in: [packages/metering-core/src/libs/MeteringService.ts:50](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L50)

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
