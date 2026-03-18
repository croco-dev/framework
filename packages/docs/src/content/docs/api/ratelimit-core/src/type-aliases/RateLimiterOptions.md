---
editUrl: false
next: false
prev: false
title: "RateLimiterOptions"
---

> **RateLimiterOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:39](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L39)

Options for RateLimiter

## Properties

### failOpen?

> `optional` **failOpen**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:43](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L43)

Whether to allow requests when store fails (default: true)

***

### keySegments

> **keySegments**: [`KeySegment`](/api/ratelimit-core/src/type-aliases/keysegment/)[]

Defined in: [packages/ratelimit-core/src/libs/types.ts:41](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L41)

Key segments to include in rate limit key

***

### onStoreError()?

> `optional` **onStoreError**: (`error`) => `void`

Defined in: [packages/ratelimit-core/src/libs/types.ts:45](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L45)

Error callback when store fails

#### Parameters

##### error

`Error`

#### Returns

`void`
