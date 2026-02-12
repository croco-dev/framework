---
editUrl: false
next: false
prev: false
title: "MeteringService"
---

Defined in: [packages/metering-core/src/libs/MeteringService.ts:26](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/MeteringService.ts#L26)

Usage Metering 핵심 서비스

## Description

- record(): 사용량 기록 (핵심 메서드)
- getUsage(): 사용량 조회
- Quota 초과 시 QuotaExceededProblem throw 또는 이벤트 발행

## Constructors

### Constructor

> **new MeteringService**(`options`): `MeteringService`

Defined in: [packages/metering-core/src/libs/MeteringService.ts:32](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/MeteringService.ts#L32)

#### Parameters

##### options

[`MeteringServiceOptions`](/api/metering-core/src/type-aliases/meteringserviceoptions/)

#### Returns

`MeteringService`

## Methods

### getUsage()

> **getUsage**(`options`): `Promise`\<`number`\>

Defined in: [packages/metering-core/src/libs/MeteringService.ts:103](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/MeteringService.ts#L103)

사용량 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>

***

### record()

> **record**(`options`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)\>

Defined in: [packages/metering-core/src/libs/MeteringService.ts:46](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/MeteringService.ts#L46)

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
