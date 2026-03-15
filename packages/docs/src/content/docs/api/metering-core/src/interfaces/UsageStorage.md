---
editUrl: false
next: false
prev: false
title: "UsageStorage"
---

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:24](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageStorage.ts#L24)

Redis 기반 실시간 Usage 저장소 인터페이스

## Description

구현체: RedisUsageStorage (이 패키지 내) 또는 사용자 커스텀
모든 메서드는 tenant 격리를 보장해야 함

## Methods

### checkAndRecordWithinQuota()?

> `optional` **checkAndRecordWithinQuota**(`options`): `Promise`\<[`AtomicQuotaCheckResult`](/api/metering-core/src/type-aliases/atomicquotacheckresult/)\>

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:54](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageStorage.ts#L54)

#### Parameters

##### options

[`AtomicQuotaCheckOptions`](/api/metering-core/src/type-aliases/atomicquotacheckoptions/)

#### Returns

`Promise`\<[`AtomicQuotaCheckResult`](/api/metering-core/src/type-aliases/atomicquotacheckresult/)\>

***

### deleteUsageRecords()?

> `optional` **deleteUsageRecords**(`options`, `records`): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:52](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageStorage.ts#L52)

Usage 데이터 삭제 (배치 저장 후)
저장이 성공한 경우에만 호출되어야 함

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

##### records

[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]

#### Returns

`Promise`\<`void`\>

***

### fetchUsageRecords()

> **fetchUsageRecords**(`options`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]\>

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:46](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageStorage.ts#L46)

Usage 데이터 조회 (배치 저장용)
Redis에서 특정 기간의 usage records 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]\>

***

### getUsage()

> **getUsage**(`options`): `Promise`\<`number`\>

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:34](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageStorage.ts#L34)

Usage 조회 (특정 기간 합산)

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>

***

### isIdempotent()

> **isIdempotent**(`tenantId`, `meterId`, `idempotencyKey`, `ttlSeconds`): `Promise`\<`boolean`\>

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:40](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageStorage.ts#L40)

Idempotency 체크 (SET NX 기반)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

##### ttlSeconds

`number`

#### Returns

`Promise`\<`boolean`\>

true: 새 키 (기록 가능), false: 중복 (기록 불가)

***

### record()

> **record**(`usage`): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:29](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/UsageStorage.ts#L29)

Usage 기록 (즉시 flush)
Redis Sorted Set에 저장

#### Parameters

##### usage

[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)

#### Returns

`Promise`\<`void`\>
