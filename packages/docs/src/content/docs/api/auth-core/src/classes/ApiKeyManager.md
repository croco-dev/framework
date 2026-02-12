---
editUrl: false
next: false
prev: false
title: "ApiKeyManager"
---

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:9](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L9)

## Constructors

### Constructor

> **new ApiKeyManager**(`store`, `generator?`, `hasher?`, `eventBus?`): `ApiKeyManager`

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:10](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L10)

#### Parameters

##### store

[`ApiKeyStore`](/api/auth-core/src/interfaces/apikeystore/)

##### generator?

[`ApiKeyGenerator`](/api/auth-core/src/classes/apikeygenerator/) = `...`

##### hasher?

[`ApiKeyHasher`](/api/auth-core/src/classes/apikeyhasher/) = `...`

##### eventBus?

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

`ApiKeyManager`

## Methods

### create()

> **create**(`options`): `Promise`\<[`CreateApiKeyResult`](/api/auth-core/src/type-aliases/createapikeyresult/)\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:17](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L17)

#### Parameters

##### options

[`CreateApiKeyOptions`](/api/auth-core/src/type-aliases/createapikeyoptions/)

#### Returns

`Promise`\<[`CreateApiKeyResult`](/api/auth-core/src/type-aliases/createapikeyresult/)\>

***

### list()

> **list**(`tenantId`): `Promise`\<`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"hash"`\>[]\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:128](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L128)

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"hash"`\>[]\>

***

### revoke()

> **revoke**(`id`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:80](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L80)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### rotate()

> **rotate**(`id`): `Promise`\<`RotateApiKeyResult`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:91](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L91)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`RotateApiKeyResult`\>

***

### verify()

> **verify**(`rawKey`): `Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:47](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L47)

#### Parameters

##### rawKey

`string`

#### Returns

`Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>
