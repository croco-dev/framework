---
editUrl: false
next: false
prev: false
title: "ApiKeyHasher"
---

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyHasher.ts:3](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/auth-core/src/libs/apikey/ApiKeyHasher.ts#L3)

## Constructors

### Constructor

> **new ApiKeyHasher**(): `ApiKeyHasher`

#### Returns

`ApiKeyHasher`

## Methods

### hash()

> **hash**(`value`): `string`

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyHasher.ts:4](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/auth-core/src/libs/apikey/ApiKeyHasher.ts#L4)

#### Parameters

##### value

`string`

#### Returns

`string`

***

### verify()

> **verify**(`value`, `hash`): `boolean`

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyHasher.ts:8](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/auth-core/src/libs/apikey/ApiKeyHasher.ts#L8)

#### Parameters

##### value

`string`

##### hash

`string`

#### Returns

`boolean`
