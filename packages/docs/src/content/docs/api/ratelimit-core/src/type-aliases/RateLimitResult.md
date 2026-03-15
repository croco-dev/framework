---
editUrl: false
next: false
prev: false
title: "RateLimitResult"
---

> **RateLimitResult** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:18](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L18)

Result of a rate limit check

## Properties

### degraded?

> `optional` **degraded**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:21](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L21)

***

### limit

> **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:23](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L23)

Maximum requests allowed in the window

***

### remaining

> **remaining**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:25](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L25)

Remaining requests in current window

***

### resetAtMs

> **resetAtMs**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:27](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L27)

Unix epoch ms when the window resets

***

### success

> **success**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:20](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/types.ts#L20)

Whether the request is allowed
