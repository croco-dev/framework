---
editUrl: false
next: false
prev: false
title: "ApiKeyGenerator"
---

안전한 API 키를 생성하는 유틸리티입니다.

## Constructors

### Constructor

> **new ApiKeyGenerator**(`shortLength?`, `longLength?`): `ApiKeyGenerator`

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

#### Parameters

##### prefix?

`string` = `"sk"`

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

> **parse**(`rawKey`): `object`

#### Parameters

##### rawKey

`string`

#### Returns

`object`

##### longToken

> **longToken**: `string`

##### prefix

> **prefix**: `string`

##### shortToken

> **shortToken**: `string`
