---
editUrl: false
next: false
prev: false
title: "RedisUsageStorage"
---

Defined in: [packages/metering-core/src/libs/RedisUsageStorage.ts:13](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/metering-core/src/libs/RedisUsageStorage.ts#L13)

Redis 기반 UsageStorage 구현체

## Description

- Usage 데이터를 Redis Sorted Set에 저장
- Idempotency 체크를 Redis SET NX로 처리

## Implements

- [`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/)

## Constructors

### Constructor

> **new RedisUsageStorage**(`redis`): `RedisUsageStorage`

Defined in: [packages/metering-core/src/libs/RedisUsageStorage.ts:17](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/metering-core/src/libs/RedisUsageStorage.ts#L17)

#### Parameters

##### redis

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/)

#### Returns

`RedisUsageStorage`

## Methods

### fetchUsageRecords()

> **fetchUsageRecords**(`options`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]\>

Defined in: [packages/metering-core/src/libs/RedisUsageStorage.ts:59](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/metering-core/src/libs/RedisUsageStorage.ts#L59)

Usage 데이터 조회 (배치 저장용)
Redis에서 특정 기간의 usage records 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]\>

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`fetchUsageRecords`](/api/metering-core/src/interfaces/usagestorage/#fetchusagerecords)

***

### getUsage()

> **getUsage**(`options`): `Promise`\<`number`\>

Defined in: [packages/metering-core/src/libs/RedisUsageStorage.ts:31](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/metering-core/src/libs/RedisUsageStorage.ts#L31)

Usage 조회 (특정 기간 합산)

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`getUsage`](/api/metering-core/src/interfaces/usagestorage/#getusage)

***

### isIdempotent()

> **isIdempotent**(`tenantId`, `meterId`, `idempotencyKey`, `ttlSeconds`): `Promise`\<`boolean`\>

Defined in: [packages/metering-core/src/libs/RedisUsageStorage.ts:49](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/metering-core/src/libs/RedisUsageStorage.ts#L49)

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

***

### record()

> **record**(`usage`): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/RedisUsageStorage.ts:19](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/metering-core/src/libs/RedisUsageStorage.ts#L19)

Usage 기록 (즉시 flush)
Redis Sorted Set에 저장

#### Parameters

##### usage

[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/).[`record`](/api/metering-core/src/interfaces/usagestorage/#record)
