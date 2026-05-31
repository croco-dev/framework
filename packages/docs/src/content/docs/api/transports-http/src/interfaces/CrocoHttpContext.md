---
editUrl: false
next: false
prev: false
title: "CrocoHttpContext"
---

## Properties

### raw

> `readonly` **raw**: `Context`

---

### req

> `readonly` **req**: [`CrocoRequest`](/api/transports-http/src/interfaces/crocorequest/)

---

### res

> `readonly` **res**: [`CrocoResponse`](/api/transports-http/src/interfaces/crocoresponse/)

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

---

### header()

> **header**(`name`): `string`

#### Parameters

##### name

`string`

#### Returns

`string`

---

### json()

> **json**\<`T`\>(): `Promise`\<`T`\>

#### Type Parameters

##### T

`T` = `unknown`

#### Returns

`Promise`\<`T`\>

---

### jsonResponse()

> **jsonResponse**\<`T`\>(`body`, `status?`): `Response`

#### Type Parameters

##### T

`T`

#### Parameters

##### body

`T`

##### status?

`number`

#### Returns

`Response`

---

### param()

> **param**(`name`): `string`

#### Parameters

##### name

`string`

#### Returns

`string`

---

### query()

> **query**(`name`): `string`

#### Parameters

##### name

`string`

#### Returns

`string`

---

### redirect()

> **redirect**(`url`, `status?`): `Response`

#### Parameters

##### url

`string`

##### status?

`number`

#### Returns

`Response`

---

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

---

### text()

> **text**(`body`, `status?`): `Response`

#### Parameters

##### body

`string`

##### status?

`number`

#### Returns

`Response`
