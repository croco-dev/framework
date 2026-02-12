---
editUrl: false
next: false
prev: false
title: "CrocoHttpContext"
---

Defined in: [packages/transports-http/src/libs/types.ts:20](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L20)

## Properties

### raw

> `readonly` **raw**: `Context`

Defined in: [packages/transports-http/src/libs/types.ts:23](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L23)

***

### req

> `readonly` **req**: [`CrocoRequest`](/api/transports-http/src/interfaces/crocorequest/)

Defined in: [packages/transports-http/src/libs/types.ts:21](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L21)

***

### res

> `readonly` **res**: [`CrocoResponse`](/api/transports-http/src/interfaces/crocoresponse/)

Defined in: [packages/transports-http/src/libs/types.ts:22](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L22)

## Methods

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [packages/transports-http/src/libs/types.ts:29](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L29)

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### header()

> **header**(`name`): `string` \| `undefined`

Defined in: [packages/transports-http/src/libs/types.ts:26](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L26)

#### Parameters

##### name

`string`

#### Returns

`string` \| `undefined`

***

### json()

> **json**\<`T`\>(): `Promise`\<`T`\>

Defined in: [packages/transports-http/src/libs/types.ts:27](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L27)

#### Type Parameters

##### T

`T` = `unknown`

#### Returns

`Promise`\<`T`\>

***

### jsonResponse()

> **jsonResponse**\<`T`\>(`body`, `status?`): `Response`

Defined in: [packages/transports-http/src/libs/types.ts:31](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L31)

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

***

### param()

> **param**(`name`): `string` \| `undefined`

Defined in: [packages/transports-http/src/libs/types.ts:24](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L24)

#### Parameters

##### name

`string`

#### Returns

`string` \| `undefined`

***

### query()

> **query**(`name`): `string` \| `undefined`

Defined in: [packages/transports-http/src/libs/types.ts:25](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L25)

#### Parameters

##### name

`string`

#### Returns

`string` \| `undefined`

***

### redirect()

> **redirect**(`url`, `status?`): `Response`

Defined in: [packages/transports-http/src/libs/types.ts:32](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L32)

#### Parameters

##### url

`string`

##### status?

`number`

#### Returns

`Response`

***

### set()

> **set**\<`T`\>(`key`, `value`): `void`

Defined in: [packages/transports-http/src/libs/types.ts:28](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L28)

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

***

### text()

> **text**(`body`, `status?`): `Response`

Defined in: [packages/transports-http/src/libs/types.ts:30](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/transports-http/src/libs/types.ts#L30)

#### Parameters

##### body

`string`

##### status?

`number`

#### Returns

`Response`
