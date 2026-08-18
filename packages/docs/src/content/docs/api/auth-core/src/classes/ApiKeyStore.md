---
editUrl: false
next: false
prev: false
title: "ApiKeyStore"
---

API 키 저장소 토큰과 추상 저장소 계약입니다.

## Extended by

- [`DrizzleApiKeyStore`](/api/auth-drizzle/src/classes/drizzleapikeystore/)

## Constructors

### Constructor

> **new ApiKeyStore**(): `ApiKeyStore`

#### Returns

`ApiKeyStore`

## Methods

### claimRotationEvent()

> `abstract` **claimRotationEvent**(`oldKeyId`, `idempotencyKey`, `claimId`, `claimExpiresAt`): `Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/) \| `null`\>

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

---

### completeRotationEvent()

> `abstract` **completeRotationEvent**(`oldKeyId`, `idempotencyKey`, `claimId`): `Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/) \| `null`\>

#### Parameters

##### oldKeyId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/) \| `null`\>

---

### delete()

> `abstract` **delete**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### findById()

> `abstract` **findById**(`id`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

---

### findByShortToken()

> `abstract` **findByShortToken**(`shortToken`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

#### Parameters

##### shortToken

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

---

### listByTenant()

> `abstract` **listByTenant**(`tenantId`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

---

### releaseRotationEvent()

> `abstract` **releaseRotationEvent**(`oldKeyId`, `idempotencyKey`, `claimId`): `Promise`\<`void`\>

#### Parameters

##### oldKeyId

`string`

##### idempotencyKey

`string`

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

---

### revoke()

> `abstract` **revoke**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### rotate()

> `abstract` **rotate**(`input`): `Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/)\>

#### Parameters

##### input

[`ApiKeyRotationInput`](/api/auth-core/src/type-aliases/apikeyrotationinput/)

#### Returns

`Promise`\<[`ApiKeyRotation`](/api/auth-core/src/type-aliases/apikeyrotation/)\>

---

### save()

> `abstract` **save**(`key`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

#### Parameters

##### key

`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"id"` \| `"createdAt"`\>

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

---

### updateLastUsed()

> `abstract` **updateLastUsed**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>
