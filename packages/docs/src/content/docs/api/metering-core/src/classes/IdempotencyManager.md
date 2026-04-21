---
editUrl: false
next: false
prev: false
title: "IdempotencyManager"
---

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L13)

Idempotency 관리자

## Description

Redis SET NX 기반으로 중복 요청을 방지합니다.
- 사용자 제공 idempotencyKey가 있으면 사용
- 없으면 ULID 자동 생성

## Constructors

### Constructor

> **new IdempotencyManager**(`redis`, `ttlSeconds?`): `IdempotencyManager`

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L19)

#### Parameters

##### redis

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/)

##### ttlSeconds?

`number` = `IdempotencyManager.DEFAULT_TTL_SECONDS`

#### Returns

`IdempotencyManager`

## Methods

### abortProcessing()

> **abortProcessing**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:80](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L80)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

***

### beginProcessing()

> **beginProcessing**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`boolean`\>

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:41](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L41)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`boolean`\>

***

### beginProcessingOrThrow()

> **beginProcessingOrThrow**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:59](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L59)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

***

### checkAndMark()

> **checkAndMark**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`boolean`\>

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:35](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L35)

중복 체크 및 키 등록

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`boolean`\>

true: 새 요청 (처리 가능), false: 중복 (이미 처리됨)

***

### checkAndMarkOrThrow()

> **checkAndMarkOrThrow**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:98](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L98)

중복 체크 - Problem throw 버전

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

#### Throws

DuplicateRecordProblem 중복 시

***

### completeProcessing()

> **completeProcessing**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:66](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L66)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

***

### ensureIdempotencyKey()

> **ensureIdempotencyKey**(`providedKey?`): `string`

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:27](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/IdempotencyManager.ts#L27)

Idempotency key 확보 (없으면 생성)

#### Parameters

##### providedKey?

`string`

#### Returns

`string`
