---
editUrl: false
next: false
prev: false
title: "ApiKeyManager"
---

API 키 생성, 검증, 폐기, 회전을 담당하는 관리자입니다.

## Constructors

### Constructor

> **new ApiKeyManager**(`store`, `generator?`, `hasher?`, `eventBus?`, `logger?`): `ApiKeyManager`

#### Parameters

##### store

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/)

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

#### Parameters

##### options

[`CreateApiKeyOptions`](/api/auth-core/src/type-aliases/createapikeyoptions/)

#### Returns

`Promise`\<[`CreateApiKeyResult`](/api/auth-core/src/type-aliases/createapikeyresult/)\>

***

### list()

> **list**(`tenantId`): `Promise`\<`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"hash"`\>[]\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"hash"`\>[]\>

***

### revoke()

> **revoke**(`id`): `Promise`\<`RevokeApiKeyResult`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`RevokeApiKeyResult`\>

***

### rotate()

> **rotate**(`id`): `Promise`\<`RotateApiKeyResult`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`RotateApiKeyResult`\>

***

### verify()

> **verify**(`rawKey`): `Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/)\>

#### Parameters

##### rawKey

`string`

#### Returns

`Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/)\>
