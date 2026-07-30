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

> **new IdempotencyManager**(`redis`, `ttlSeconds?`, `processingLeaseMilliseconds?`): `IdempotencyManager`

#### Parameters

##### redis

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/)

##### ttlSeconds?

`number` = `IdempotencyManager.DEFAULT_TTL_SECONDS`

##### processingLeaseMilliseconds?

`number` = `IdempotencyManager.DEFAULT_PROCESSING_LEASE_MILLISECONDS`

#### Returns

`IdempotencyManager`

## Methods

### abortMeteringProcessing()

> **abortMeteringProcessing**(`tenantId`, `meterId`, `idempotencyKey`, `token`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

##### token

[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)

#### Returns

`Promise`\<`void`\>

---

### abortProcessing()

> **abortProcessing**(`tenantId`, `meterId`, `idempotencyKey`, `claim`): `Promise`\<`void`\>

현재 claim이 소유한 처리 중 lease만 삭제합니다.

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

##### claim

[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)

#### Returns

`Promise`\<`void`\>

---

### beginProcessing()

> **beginProcessing**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/) \| `null`\>

처리 lease를 원자적으로 획득합니다.

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/) \| `null`\>

새 lease의 ownership claim, 중복 key이면 null

---

### beginProcessingOrThrow()

> **beginProcessingOrThrow**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)\>

처리 lease를 획득하고 현재 소유권 claim을 반환합니다.

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)\>

새 lease의 claim

#### Throws

DuplicateRecordProblem 동일한 idempotency key가 이미 처리 중이거나 완료된 경우

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

### claimMeteringProcessingOrThrow()

> **claimMeteringProcessingOrThrow**(`tenantId`, `meterId`, `idempotencyKey`): `Promise`\<[`MeteringProcessingClaim`](/api/metering-core/src/type-aliases/meteringprocessingclaim/)\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`MeteringProcessingClaim`](/api/metering-core/src/type-aliases/meteringprocessingclaim/)\>

---

### completeMeteringProcessing()

> **completeMeteringProcessing**(`tenantId`, `meterId`, `idempotencyKey`, `token`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

##### token

[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)

#### Returns

`Promise`\<`void`\>

---

### completeProcessing()

> **completeProcessing**(`tenantId`, `meterId`, `idempotencyKey`, `claim`): `Promise`\<`void`\>

현재 claim이 소유한 lease만 완료 상태로 전환합니다.

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

##### claim

[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)

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

---

### markMeteringEventsPublishing()

> **markMeteringEventsPublishing**(`tenantId`, `meterId`, `idempotencyKey`, `token`, `delivery`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

##### token

[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)

##### delivery

[`PendingMeteringDelivery`](/api/metering-core/src/type-aliases/pendingmeteringdelivery/)

#### Returns

`Promise`\<`void`\>

---

### releaseMeteringEvents()

> **releaseMeteringEvents**(`tenantId`, `meterId`, `idempotencyKey`, `token`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

##### token

[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)

#### Returns

`Promise`\<`void`\>

---

### releaseMeteringProcessing()

> **releaseMeteringProcessing**(`tenantId`, `meterId`, `idempotencyKey`, `token`): `Promise`\<`void`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### idempotencyKey

`string`

##### token

[`IdempotencyClaim`](/api/metering-core/src/type-aliases/idempotencyclaim/)

#### Returns

`Promise`\<`void`\>
