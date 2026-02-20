---
editUrl: false
next: false
prev: false
title: "KeyContext"
---

> **KeyContext** = `object`

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:7](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L7)

Context interface for extracting rate limit key segments.
Compatible with ExecutionContext and CrocoHttpContext.

## Methods

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:8](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L8)

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`
