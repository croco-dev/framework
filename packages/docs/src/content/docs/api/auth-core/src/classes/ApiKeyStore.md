---
editUrl: false
next: false
prev: false
title: "ApiKeyStore"
---

API 키 저장소 토큰과 추상 저장소 계약입니다.

## Constructors

### Constructor

> **new ApiKeyStore**(): `ApiKeyStore`

#### Returns

`ApiKeyStore`

## Methods

### delete()

> `abstract` **delete**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### findById()

> `abstract` **findById**(`id`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

---

### findByShortToken()

> `abstract` **findByShortToken**(`shortToken`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

#### Parameters

##### shortToken

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

---

### listByTenant()

> `abstract` **listByTenant**(`tenantId`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

---

### revoke()

> `abstract` **revoke**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

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
