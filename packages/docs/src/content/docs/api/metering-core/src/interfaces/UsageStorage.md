---
editUrl: false
next: false
prev: false
title: "UsageStorage"
---

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:10](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/UsageStorage.ts#L10)

Redis 기반 실시간 Usage 저장소 인터페이스

## Description

구현체: RedisUsageStorage (이 패키지 내) 또는 사용자 커스텀
모든 메서드는 tenant 격리를 보장해야 함

## Methods

### fetchUsageRecords()

> **fetchUsageRecords**(`options`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]\>

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:32](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/UsageStorage.ts#L32)

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

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:20](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/UsageStorage.ts#L20)

Usage 조회 (특정 기간 합산)

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>

***

### isIdempotent()

> **isIdempotent**(`tenantId`, `meterId`, `idempotencyKey`, `ttlSeconds`): `Promise`\<`boolean`\>

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:26](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/UsageStorage.ts#L26)

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

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:15](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/UsageStorage.ts#L15)

Usage 기록 (즉시 flush)
Redis Sorted Set에 저장

#### Parameters

##### usage

[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)

#### Returns

`Promise`\<`void`\>
