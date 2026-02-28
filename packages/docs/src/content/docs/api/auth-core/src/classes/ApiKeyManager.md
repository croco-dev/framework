---
editUrl: false
next: false
prev: false
title: "ApiKeyManager"
---

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:11](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L11)

Manages API key lifecycle operations.

## Constructors

### Constructor

> **new ApiKeyManager**(`store`, `generator?`, `hasher?`, `eventBus?`, `logger?`): `ApiKeyManager`

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L12)

#### Parameters

##### store

[`ApiKeyStore`](/api/auth-core/src/interfaces/apikeystore/)

##### generator?

[`ApiKeyGenerator`](/api/auth-core/src/classes/apikeygenerator/) = `...`

##### hasher?

[`ApiKeyHasher`](/api/auth-core/src/classes/apikeyhasher/) = `...`

##### eventBus?

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

##### logger?

`Logger`

#### Returns

`ApiKeyManager`

## Methods

### create()

> **create**(`options`): `Promise`\<[`CreateApiKeyResult`](/api/auth-core/src/type-aliases/createapikeyresult/)\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:20](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L20)

#### Parameters

##### options

[`CreateApiKeyOptions`](/api/auth-core/src/type-aliases/createapikeyoptions/)

#### Returns

`Promise`\<[`CreateApiKeyResult`](/api/auth-core/src/type-aliases/createapikeyresult/)\>

***

### list()

> **list**(`tenantId`): `Promise`\<`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"hash"`\>[]\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:147](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L147)

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"hash"`\>[]\>

***

### revoke()

> **revoke**(`id`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:91](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L91)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### rotate()

> **rotate**(`id`): `Promise`\<`RotateApiKeyResult`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:106](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L106)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`RotateApiKeyResult`\>

***

### verify()

> **verify**(`rawKey`): `Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:54](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L54)

#### Parameters

##### rawKey

`string`

#### Returns

`Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>
