---
editUrl: false
next: false
prev: false
title: "HttpContext"
---

HTTP 미들웨어 형태로 레이트 리밋을 적용하는 헬퍼와 타입입니다.

## Properties

### req

> `readonly` **req**: `object`

#### headers

> **headers**: `Record`\<`string`, `string`\>

#### method

> **method**: `string`

#### path

> **path**: `string`

## Methods

### get()

> **get**\<`T`\>(`key`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T`

***

### set()

> **set**\<`T`\>(`key`, `value`): `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### value

`T`

#### Returns

`void`
