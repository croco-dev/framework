---
editUrl: false
next: false
prev: false
title: "IdempotencyManager"
---

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:13](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/IdempotencyManager.ts#L13)

Idempotency 관리자

## Description

Redis SET NX 기반으로 중복 요청을 방지합니다.
- 사용자 제공 idempotencyKey가 있으면 사용
- 없으면 ULID 자동 생성

## Constructors

### Constructor

> **new IdempotencyManager**(`redis`, `ttlSeconds?`): `IdempotencyManager`

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:17](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/IdempotencyManager.ts#L17)

#### Parameters

##### redis

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/)

##### ttlSeconds?

`number` = `IdempotencyManager.DEFAULT_TTL_SECONDS`

#### Returns

`IdempotencyManager`

## Methods

### checkAndMark()

> **checkAndMark**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`boolean`\>

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:33](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/IdempotencyManager.ts#L33)

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

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:43](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/IdempotencyManager.ts#L43)

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

### ensureIdempotencyKey()

> **ensureIdempotencyKey**(`providedKey?`): `string`

Defined in: [packages/metering-core/src/libs/IdempotencyManager.ts:25](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/IdempotencyManager.ts#L25)

Idempotency key 확보 (없으면 생성)

#### Parameters

##### providedKey?

`string`

#### Returns

`string`
