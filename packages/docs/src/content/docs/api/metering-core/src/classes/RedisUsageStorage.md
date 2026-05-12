---
editUrl: false
next: false
prev: false
title: "RedisUsageStorage"
---

Redis 기반 UsageStorage 구현체

## Description

- Usage 데이터를 Redis Sorted Set에 저장
- Idempotency 체크를 Redis SET NX로 처리

## Implements

- [`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/)

## Constructors

### Constructor

> **new RedisUsageStorage**(`redis`): `RedisUsageStorage`

#### Parameters

##### redis

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/)

#### Returns

`RedisUsageStorage`

## Methods

### checkAndRecordWithinQuota()

> **checkAndRecordWithinQuota**(`options`): `Promise`\<[`AtomicQuotaCheckResult`](/api/metering-core/src/type-aliases/atomicquotacheckresult/)\>

#### Parameters

##### options

[`AtomicQuotaCheckOptions`](/api/metering-core/src/type-aliases/atomicquotacheckoptions/)

#### Returns

`Promise`\<[`AtomicQuotaCheckResult`](/api/metering-core/src/type-aliases/atomicquotacheckresult/)\>

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`checkAndRecordWithinQuota`](/api/metering-core/src/interfaces/usagestorage/#checkandrecordwithinquota)

---

### fetchUsageRecords()

> **fetchUsageRecords**(`options`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]\>

Usage 데이터 조회 (배치 저장용)
Redis에서 특정 기간의 usage records 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]\>

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`fetchUsageRecords`](/api/metering-core/src/interfaces/usagestorage/#fetchusagerecords)

---

### getUsage()

> **getUsage**(`options`): `Promise`\<`number`\>

Usage 조회 (특정 기간 합산)

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`getUsage`](/api/metering-core/src/interfaces/usagestorage/#getusage)

---

### isIdempotent()

> **isIdempotent**(`tenantId`, `meterId`, `idempotencyKey`, `ttlSeconds`): `Promise`\<`boolean`\>

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

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`isIdempotent`](/api/metering-core/src/interfaces/usagestorage/#isidempotent)

---

### record()

> **record**(`usage`): `Promise`\<`void`\>

Usage 기록 (즉시 flush)
Redis Sorted Set에 저장

#### Parameters

##### usage

[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`record`](/api/metering-core/src/interfaces/usagestorage/#record)

---

### resetBillingCycle()

> **resetBillingCycle**(`tenantId`, `meterId?`): `Promise`\<`void`\>

빌링 주기 리셋
현재 빌링 주기의 모든 usage 데이터를 삭제합니다.

#### Parameters

##### tenantId

`string`

##### meterId?

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`resetBillingCycle`](/api/metering-core/src/interfaces/usagestorage/#resetbillingcycle)
