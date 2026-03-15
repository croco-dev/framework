---
editUrl: false
next: false
prev: false
title: "RateLimiterOptions"
---

> **RateLimiterOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:38](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L38)

Options for RateLimiter

## Properties

### failOpen?

> `optional` **failOpen**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:42](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L42)

Whether to allow requests when store fails (default: true)

***

### keySegments

> **keySegments**: [`KeySegment`](/api/ratelimit-core/src/type-aliases/keysegment/)[]

Defined in: [packages/ratelimit-core/src/libs/types.ts:40](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L40)

Key segments to include in rate limit key

***

### onStoreError()?

> `optional` **onStoreError**: (`error`) => `void`

Defined in: [packages/ratelimit-core/src/libs/types.ts:44](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L44)

Error callback when store fails

#### Parameters

##### error

`Error`

#### Returns

`void`
