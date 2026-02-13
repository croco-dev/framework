---
editUrl: false
next: false
prev: false
title: "RateLimitMetadata"
---

> **RateLimitMetadata** = `object`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:15](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L15)

Rate limit metadata stored by

## Rate Limit

decorator.

## Properties

### customKey()?

> `optional` **customKey**: (`context`) => `string`

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:17](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L17)

#### Parameters

##### context

`unknown`

#### Returns

`string`

***

### policy

> **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Defined in: [packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts:16](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/guards/RateLimitGuard.ts#L16)
