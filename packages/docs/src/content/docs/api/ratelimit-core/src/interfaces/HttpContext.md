---
editUrl: false
next: false
prev: false
title: "HttpContext"
---

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:10](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L10)

CrocoHttpContext interface (compatible with transports-http).
Defined here to avoid circular dependency.

## Properties

### req

> `readonly` **req**: `object`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:11](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L11)

#### headers

> **headers**: `Record`\<`string`, `string`\>

#### method

> **method**: `string`

#### path

> **path**: `string`

## Methods

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:17](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L17)

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

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:16](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L16)

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
