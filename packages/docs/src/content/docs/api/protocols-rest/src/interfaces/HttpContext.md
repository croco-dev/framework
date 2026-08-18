---
editUrl: false
next: false
prev: false
title: "HttpContext"
---

## Properties

### request

> `readonly` **request**: [`HttpRequestLike`](/api/protocols-rest/src/interfaces/httprequestlike/)

---

### response

> `readonly` **response**: [`HttpResponseLike`](/api/protocols-rest/src/interfaces/httpresponselike/)

## Methods

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

---

### header()

> **header**(`name`): `string` \| `undefined`

#### Parameters

##### name

`string`

#### Returns

`string` \| `undefined`

---

### json()

> **json**\<`T`\>(): `Promise`\<`T`\>

#### Type Parameters

##### T

`T` = `unknown`

#### Returns

`Promise`\<`T`\>

---

### param()

> **param**(`name`): `string` \| `undefined`

#### Parameters

##### name

`string`

#### Returns

`string` \| `undefined`

---

### query()

> **query**(`name`): `string` \| `string`[] \| `undefined`

#### Parameters

##### name

`string`

#### Returns

`string` \| `string`[] \| `undefined`

---

### set()

> **set**(`key`, `value`): `void`

#### Parameters

##### key

`string`

##### value

`unknown`

#### Returns

`void`
