---
editUrl: false
next: false
prev: false
title: "HttpContext"
---

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L6)

## Properties

### req

> `readonly` **req**: `object`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:7](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L7)

#### headers

> **headers**: `Record`\<`string`, `string`\>

#### method

> **method**: `string`

#### path

> **path**: `string`

## Methods

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:13](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L13)

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### set()

> **set**\<`T`\>(`key`, `value`): `void`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:12](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L12)

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
