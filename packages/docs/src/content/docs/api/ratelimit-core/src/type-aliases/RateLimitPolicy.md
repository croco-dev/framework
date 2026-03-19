---
editUrl: false
next: false
prev: false
title: "RateLimitPolicy"
---

> **RateLimitPolicy** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:5](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L5)

Core policy, decorator, and middleware option types.

## Properties

### algorithm?

> `optional` **algorithm**: `"sliding"`

Defined in: [packages/ratelimit-core/src/libs/types.ts:13](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L13)

Algorithm type (reserved for future use)

***

### limit

> **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L9)

Maximum number of requests allowed

***

### name

> **name**: `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L7)

Policy identifier (used as key segment)

***

### windowMs

> **windowMs**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:11](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/types.ts#L11)

Time window in milliseconds
