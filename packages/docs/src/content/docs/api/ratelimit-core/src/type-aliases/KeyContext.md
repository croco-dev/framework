---
editUrl: false
next: false
prev: false
title: "KeyContext"
---

> **KeyContext** = `object`

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L8)

Context interface for extracting rate limit key segments.
Compatible with ExecutionContext and CrocoHttpContext.

## Methods

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L9)

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`
