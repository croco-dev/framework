---
editUrl: false
next: false
prev: false
title: "RateLimitResult"
---

> **RateLimitResult** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:19](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L19)

Result of a rate limit check

## Properties

### degraded?

> `optional` **degraded**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:22](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L22)

***

### limit

> **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:24](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L24)

Maximum requests allowed in the window

***

### remaining

> **remaining**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:26](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L26)

Remaining requests in current window

***

### resetAtMs

> **resetAtMs**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:28](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L28)

Unix epoch ms when the window resets

***

### success

> **success**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:21](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L21)

Whether the request is allowed
