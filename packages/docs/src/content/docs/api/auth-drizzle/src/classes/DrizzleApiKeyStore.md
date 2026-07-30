---
editUrl: false
next: false
prev: false
title: "DrizzleApiKeyStore"
---

API 키 저장소를 Drizzle 쿼리로 구현한 클래스입니다.

## Extends

- [`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/)

## Constructors

### Constructor

> **new DrizzleApiKeyStore**(`db`, `schema`): `DrizzleApiKeyStore`

Drizzle DB와 API 키 스키마를 받아 저장소를 초기화합니다.

#### Parameters

##### db

`DrizzleDb`

##### schema

###### apiKeyRotations?

`PgTableWithColumns`\<\{ `columns`: \{ `createdAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"created_at"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `eventClaimExpiresAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"event_claim_expires_at"`; `notNull`: `false`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `eventClaimId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"event_claim_id"`; `notNull`: `false`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `eventId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"event_id"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `eventOccurredAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"event_occurred_at"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `eventStatus`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `"pending"` \| `"processing"` \| `"completed"`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`"pending"`, `"processing"`, `"completed"`\]; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"event_status"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `idempotencyKey`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"idempotency_key"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `newKeyId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgUUID"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"new_key_id"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `oldKeyId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgUUID"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `true`; `name`: `"old_key_id"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `recoveryCiphertext`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"recovery_ciphertext"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; `tenantId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"tenant_id"`; `notNull`: `true`; `tableName`: `"api_key_rotations"`; \}, \{ \}, \{ \}\>; \}; `dialect`: `"pg"`; `name`: `"api_key_rotations"`; `schema`: `undefined`; \}\>

###### apiKeys

`PgTableWithColumns`\<\{ `columns`: \{ `allowedIps`: `PgColumn`\<\{ `baseColumn`: `Column`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"allowed_ips"`; `notNull`: `false`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `columnType`: `"PgArray"`; `data`: `string`[]; `dataType`: `"array"`; `driverParam`: `string` \| `string`[]; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"allowed_ips"`; `notNull`: `false`; `tableName`: `"api_keys"`; \}, \{ \}, \{ `baseBuilder`: `PgColumnBuilder`\<\{ `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `name`: `"allowed_ips"`; \}, \{ \}, \{ \}, `ColumnBuilderExtraConfig`\>; `size`: `undefined`; \}\>; `createdAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"created_at"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `createdBy`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"created_by"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `expiresAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"expires_at"`; `notNull`: `false`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `hash`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"hash"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `id`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgUUID"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `true`; `name`: `"id"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `lastUsedAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"last_used_at"`; `notNull`: `false`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `name`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"name"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `permissions`: `PgColumn`\<\{ `baseColumn`: `Column`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"permissions"`; `notNull`: `false`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `columnType`: `"PgArray"`; `data`: `string`[]; `dataType`: `"array"`; `driverParam`: `string` \| `string`[]; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `true`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"permissions"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ `baseBuilder`: `PgColumnBuilder`\<\{ `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `name`: `"permissions"`; \}, \{ \}, \{ \}, `ColumnBuilderExtraConfig`\>; `size`: `undefined`; \}\>; `prefix`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"prefix"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `rateLimit`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgJson"`; `data`: \{ `duration`: `number`; `limit`: `number`; \}; `dataType`: `"json"`; `driverParam`: `unknown`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"rate_limit"`; `notNull`: `false`; `tableName`: `"api_keys"`; \}, \{ \}, \{ `$type`: \{ `duration`: `number`; `limit`: `number`; \}; \}\>; `revokedAt`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgTimestamp"`; `data`: `Date`; `dataType`: `"date"`; `driverParam`: `string`; `enumValues`: `undefined`; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"revoked_at"`; `notNull`: `false`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `shortToken`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"short_token"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; `tenantId`: `PgColumn`\<\{ `baseColumn`: `never`; `columnType`: `"PgText"`; `data`: `string`; `dataType`: `"string"`; `driverParam`: `string`; `enumValues`: \[`string`, `...string[]`\]; `generated`: `undefined`; `hasDefault`: `false`; `hasRuntimeDefault`: `false`; `identity`: `undefined`; `isAutoincrement`: `false`; `isPrimaryKey`: `false`; `name`: `"tenant_id"`; `notNull`: `true`; `tableName`: `"api_keys"`; \}, \{ \}, \{ \}\>; \}; `dialect`: `"pg"`; `name`: `"api_keys"`; `schema`: `undefined`; \}\>

#### Returns

`DrizzleApiKeyStore`

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`constructor`](/api/auth-core/src/classes/apikeystore/#constructor)

## Methods

### claimRotationEvent()

> **claimRotationEvent**(`oldKeyId`, `idempotencyKey`, `claimId`, `claimExpiresAt`): `Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/) \| `null`\>

#### Parameters

##### oldKeyId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

##### claimExpiresAt

`Date`

#### Returns

`Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/) \| `null`\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`claimRotationEvent`](/api/auth-core/src/classes/apikeystore/#claimrotationevent)

***

### completeRotationEvent()

> **completeRotationEvent**(`oldKeyId`, `idempotencyKey`, `claimId`): `Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/) \| `null`\>

#### Parameters

##### oldKeyId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/) \| `null`\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`completeRotationEvent`](/api/auth-core/src/classes/apikeystore/#completerotationevent)

***

### delete()

> **delete**(`id`): `Promise`\<`void`\>

API 키를 영구 삭제합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`delete`](/api/auth-core/src/classes/apikeystore/#delete)

***

### findById()

> **findById**(`id`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

ID로 API 키를 조회합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`findById`](/api/auth-core/src/classes/apikeystore/#findbyid)

***

### findByShortToken()

> **findByShortToken**(`shortToken`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

짧은 토큰 값으로 API 키를 조회합니다.

#### Parameters

##### shortToken

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`findByShortToken`](/api/auth-core/src/classes/apikeystore/#findbyshorttoken)

***

### listByTenant()

> **listByTenant**(`tenantId`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

테넌트에 속한 API 키 목록을 조회합니다.

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`listByTenant`](/api/auth-core/src/classes/apikeystore/#listbytenant)

***

### releaseRotationEvent()

> **releaseRotationEvent**(`oldKeyId`, `idempotencyKey`, `claimId`): `Promise`\<`void`\>

#### Parameters

##### oldKeyId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`releaseRotationEvent`](/api/auth-core/src/classes/apikeystore/#releaserotationevent)

***

### revoke()

> **revoke**(`id`): `Promise`\<`void`\>

API 키를 폐기 처리합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`revoke`](/api/auth-core/src/classes/apikeystore/#revoke)

***

### rotate()

> **rotate**(`input`): `Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/)\>

새 키 저장, 기존 키 폐기, 회전 복구 의도 기록을 한 트랜잭션으로 처리합니다.

#### Parameters

##### input

[`ApiKeyRotationInput`](/api/auth-core/src/type-aliases/apikeyrotationinput/)

#### Returns

`Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/)\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`rotate`](/api/auth-core/src/classes/apikeystore/#rotate)

***

### save()

> **save**(`key`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

새 API 키를 저장하고 저장된 값을 반환합니다.

#### Parameters

##### key

`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"id"` \| `"createdAt"`\>

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`save`](/api/auth-core/src/classes/apikeystore/#save)

***

### updateLastUsed()

> **updateLastUsed**(`id`): `Promise`\<`void`\>

마지막 사용 시각을 현재 시각으로 갱신합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/).[`updateLastUsed`](/api/auth-core/src/classes/apikeystore/#updatelastused)
