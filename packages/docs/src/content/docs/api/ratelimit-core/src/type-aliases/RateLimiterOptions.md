---
editUrl: false
next: false
prev: false
title: "RateLimiterOptions"
---

> **RateLimiterOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:37](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L37)

Options for RateLimiter

## Properties

### failOpen?

> `optional` **failOpen**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:41](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L41)

Whether to allow requests when store fails (default: true)

***

### keySegments

> **keySegments**: [`KeySegment`](/api/ratelimit-core/src/type-aliases/keysegment/)[]

Defined in: [packages/ratelimit-core/src/libs/types.ts:39](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L39)

Key segments to include in rate limit key

***

### onStoreError()?

> `optional` **onStoreError**: (`error`) => `void`

Defined in: [packages/ratelimit-core/src/libs/types.ts:43](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L43)

Error callback when store fails

#### Parameters

##### error

`Error`

#### Returns

`void`
