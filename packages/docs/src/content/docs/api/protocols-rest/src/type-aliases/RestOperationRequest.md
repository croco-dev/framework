---
editUrl: false
next: false
prev: false
title: "RestOperationRequest"
---

> **RestOperationRequest** = `object`

Server-owned request boundary. Credentials must be verified before createContext returns.

## Properties

### req

> `readonly` **req**: `object`

#### headers

> `readonly` **headers**: `Record`\<`string`, `string`\>

#### params

> `readonly` **params**: `Record`\<`string`, `string`\>

#### query

> `readonly` **query**: `Record`\<`string`, `string` \| `string`[]\>

## Methods

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

#### Type Parameters

##### T

`T`

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

> **json**(): `Promise`\<`unknown`\>

#### Returns

`Promise`\<`unknown`\>
