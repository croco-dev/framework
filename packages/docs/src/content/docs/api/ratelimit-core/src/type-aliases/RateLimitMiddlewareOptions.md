---
editUrl: false
next: false
prev: false
title: "RateLimitMiddlewareOptions"
---

> **RateLimitMiddlewareOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:63](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L63)

Options for global rate limit middleware

## Properties

### failOpen?

> `optional` **failOpen**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:69](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L69)

Whether to allow requests when store fails

***

### keySegments?

> `optional` **keySegments**: [`KeySegment`](/api/ratelimit-core/src/type-aliases/keysegment/)[]

Defined in: [packages/ratelimit-core/src/libs/types.ts:67](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L67)

Key segments to use for building keys

***

### policy

> **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Defined in: [packages/ratelimit-core/src/libs/types.ts:65](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L65)

Rate limit policy to apply
