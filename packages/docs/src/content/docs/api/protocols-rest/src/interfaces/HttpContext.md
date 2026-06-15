---
editUrl: false
next: false
prev: false
title: "HttpContext"
---

## Properties

### request

> `readonly` **request**: [`HttpRequestLike`](/api/protocols-rest/src/interfaces/httprequestlike/)

***

### response

> `readonly` **response**: [`HttpResponseLike`](/api/protocols-rest/src/interfaces/httpresponselike/)

## Methods

### get()

> **get**\<`T`\>(`key`): `T`

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### key

`string`

#### Returns

`T`

***

### header()

> **header**(`name`): `string`

#### Parameters

##### name

`string`

#### Returns

`string`

***

### json()

> **json**\<`T`\>(): `Promise`\<`T`\>

#### Type Parameters

##### T

`T` = `unknown`

#### Returns

`Promise`\<`T`\>

***

### param()

> **param**(`name`): `string`

#### Parameters

##### name

`string`

#### Returns

`string`

***

### query()

> **query**(`name`): `string`

#### Parameters

##### name

`string`

#### Returns

`string`

***

### set()

> **set**(`key`, `value`): `void`

#### Parameters

##### key

`string`

##### value

`unknown`

#### Returns

`void`
