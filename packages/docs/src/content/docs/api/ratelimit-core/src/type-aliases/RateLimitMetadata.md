---
editUrl: false
next: false
prev: false
title: "RateLimitMetadata"
---

> **RateLimitMetadata** = `object`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:19](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L19)

Rate limit metadata stored by

## Rate Limit

decorator.

## Properties

### customKey()?

> `optional` **customKey**: (`context`) => `string`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:21](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L21)

#### Parameters

##### context

`unknown`

#### Returns

`string`

***

### policy

> **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:20](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L20)
