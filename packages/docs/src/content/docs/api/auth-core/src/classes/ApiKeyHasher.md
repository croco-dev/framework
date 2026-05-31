---
editUrl: false
next: false
prev: false
title: "ApiKeyHasher"
---

API 키 해시 생성과 검증을 담당합니다.

## Constructors

### Constructor

> **new ApiKeyHasher**(): `ApiKeyHasher`

#### Returns

`ApiKeyHasher`

## Methods

### hash()

> **hash**(`value`): `string`

#### Parameters

##### value

`string`

#### Returns

`string`

---

### verify()

> **verify**(`value`, `hash`): `boolean`

#### Parameters

##### value

`string`

##### hash

`string`

#### Returns

`boolean`
