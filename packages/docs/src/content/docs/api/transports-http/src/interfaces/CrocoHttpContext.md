---
editUrl: false
next: false
prev: false
title: "CrocoHttpContext"
---

Defined in: [packages/transports-http/src/libs/types.ts:26](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L26)

## Properties

### raw

> `readonly` **raw**: `Context`

Defined in: [packages/transports-http/src/libs/types.ts:29](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L29)

***

### req

> `readonly` **req**: [`CrocoRequest`](/api/transports-http/src/interfaces/crocorequest/)

Defined in: [packages/transports-http/src/libs/types.ts:27](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L27)

***

### res

> `readonly` **res**: [`CrocoResponse`](/api/transports-http/src/interfaces/crocoresponse/)

Defined in: [packages/transports-http/src/libs/types.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L28)

## Methods

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [packages/transports-http/src/libs/types.ts:35](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L35)

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

Defined in: [packages/transports-http/src/libs/types.ts:32](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L32)

#### Parameters

##### name

`string`

#### Returns

`string` \| `undefined`

***

### json()

> **json**\<`T`\>(): `Promise`\<`T`\>

Defined in: [packages/transports-http/src/libs/types.ts:33](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L33)

#### Type Parameters

##### T

`T` = `unknown`

#### Returns

`Promise`\<`T`\>

***

### jsonResponse()

> **jsonResponse**\<`T`\>(`body`, `status?`): `Response`

Defined in: [packages/transports-http/src/libs/types.ts:37](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L37)

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

Defined in: [packages/transports-http/src/libs/types.ts:30](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L30)

#### Parameters

##### name

`string`

#### Returns

`string` \| `undefined`

***

### query()

> **query**(`name`): `string` \| `undefined`

Defined in: [packages/transports-http/src/libs/types.ts:31](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L31)

#### Parameters

##### name

`string`

#### Returns

`string` \| `undefined`

***

### redirect()

> **redirect**(`url`, `status?`): `Response`

Defined in: [packages/transports-http/src/libs/types.ts:38](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L38)

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

Defined in: [packages/transports-http/src/libs/types.ts:34](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L34)

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

Defined in: [packages/transports-http/src/libs/types.ts:36](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/types.ts#L36)

#### Parameters

##### body

`string`

##### status?

`number`

#### Returns

`Response`
