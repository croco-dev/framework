---
editUrl: false
next: false
prev: false
title: "ApiKeyManager"
---

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:18](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L18)

API 키 생성, 검증, 폐기, 회전을 담당하는 관리자입니다.

## Constructors

### Constructor

> **new ApiKeyManager**(`store`, `generator?`, `hasher?`, `eventBus?`, `logger?`): `ApiKeyManager`

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L19)

#### Parameters

##### store

[`ApiKeyStore`](/api/auth-core/src/classes/apikeystore/)

##### generator?

[`ApiKeyGenerator`](/api/auth-core/src/classes/apikeygenerator/) = `...`

##### hasher?

[`ApiKeyHasher`](/api/auth-core/src/classes/apikeyhasher/) = `...`

##### eventBus?

[`EventBus`](/api/events-core/src/interfaces/eventbus/)\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>

##### logger?

`Logger`

#### Returns

`ApiKeyManager`

## Methods

### create()

> **create**(`options`): `Promise`\<[`CreateApiKeyResult`](/api/auth-core/src/type-aliases/createapikeyresult/)\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:40](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L40)

#### Parameters

##### options

[`CreateApiKeyOptions`](/api/auth-core/src/type-aliases/createapikeyoptions/)

#### Returns

`Promise`\<[`CreateApiKeyResult`](/api/auth-core/src/type-aliases/createapikeyresult/)\>

***

### list()

> **list**(`tenantId`): `Promise`\<`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"hash"`\>[]\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:176](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L176)

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"hash"`\>[]\>

***

### revoke()

> **revoke**(`id`): `Promise`\<`RevokeApiKeyResult`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:113](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L113)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`RevokeApiKeyResult`\>

***

### rotate()

> **rotate**(`id`): `Promise`\<`RotateApiKeyResult`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:133](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L133)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`RotateApiKeyResult`\>

***

### verify()

> **verify**(`rawKey`): `Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyManager.ts:74](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/apikey/ApiKeyManager.ts#L74)

#### Parameters

##### rawKey

`string`

#### Returns

`Promise`\<[`ApiKeyPrincipal`](/api/auth-core/src/type-aliases/apikeyprincipal/) \| `null`\>
