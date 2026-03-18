---
editUrl: false
next: false
prev: false
title: "RateLimitDecoratorOptions"
---

> **RateLimitDecoratorOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:51](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L51)

Options for

## Rate Limit

decorator

## Properties

### key()?

> `optional` **key**: (`context`) => `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:59](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L59)

Custom key resolver function

#### Parameters

##### context

`unknown`

#### Returns

`string`

***

### limit?

> `optional` **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:53](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L53)

Maximum requests allowed (overrides policy)

***

### policy?

> `optional` **policy**: `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:57](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L57)

Pre-defined policy name to use

***

### window?

> `optional` **window**: `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:55](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L55)

Time window string ('1m', '1h', '1d')
