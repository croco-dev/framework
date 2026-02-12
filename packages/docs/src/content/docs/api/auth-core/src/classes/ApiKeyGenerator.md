---
editUrl: false
next: false
prev: false
title: "ApiKeyGenerator"
---

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyGenerator.ts:3](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/auth-core/src/libs/apikey/ApiKeyGenerator.ts#L3)

## Constructors

### Constructor

> **new ApiKeyGenerator**(`shortLength?`, `longLength?`): `ApiKeyGenerator`

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyGenerator.ts:4](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/auth-core/src/libs/apikey/ApiKeyGenerator.ts#L4)

#### Parameters

##### shortLength?

`number` = `12`

##### longLength?

`number` = `32`

#### Returns

`ApiKeyGenerator`

## Methods

### generate()

> **generate**(`prefix?`): `object`

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyGenerator.ts:9](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/auth-core/src/libs/apikey/ApiKeyGenerator.ts#L9)

#### Parameters

##### prefix?

`string` = `'sk'`

#### Returns

`object`

##### fullKey

> **fullKey**: `string`

##### longToken

> **longToken**: `string`

##### prefix

> **prefix**: `string`

##### shortToken

> **shortToken**: `string`

***

### parse()

> **parse**(`rawKey`): \{ `longToken`: `string`; `prefix`: `string`; `shortToken`: `string`; \} \| `null`

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyGenerator.ts:21](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/auth-core/src/libs/apikey/ApiKeyGenerator.ts#L21)

#### Parameters

##### rawKey

`string`

#### Returns

\{ `longToken`: `string`; `prefix`: `string`; `shortToken`: `string`; \} \| `null`
