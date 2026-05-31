---
editUrl: false
next: false
prev: false
title: "IdempotencyManager"
---

Idempotency 관리자

## Description

Redis SET NX 기반으로 중복 요청을 방지합니다.

- 사용자 제공 idempotencyKey가 있으면 사용
- 없으면 ULID 자동 생성

## Constructors

### Constructor

> **new IdempotencyManager**(`redis`, `ttlSeconds?`): `IdempotencyManager`

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

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

---

### beginProcessing()

> **beginProcessing**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`boolean`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`boolean`\>

---

### beginProcessingOrThrow()

> **beginProcessingOrThrow**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

---

### checkAndMark()

> **checkAndMark**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`boolean`\>

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

---

### checkAndMarkOrThrow()

> **checkAndMarkOrThrow**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`void`\>

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

---

### completeProcessing()

> **completeProcessing**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<`void`\>

---

### ensureIdempotencyKey()

> **ensureIdempotencyKey**(`providedKey?`): `string`

Idempotency key 확보 (없으면 생성)

#### Parameters

##### providedKey?

`string`

#### Returns

`string`
