---
editUrl: false
next: false
prev: false
title: "CreateMiddlewareOptions"
---

> **CreateMiddlewareOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:28](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L28)

Options for creating rate limit middleware.

## Properties

### addHeaders?

> `optional` **addHeaders**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:36](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L36)

Whether to add X-RateLimit-* headers (default: true)

***

### keySegments?

> `optional` **keySegments**: [`KeySegment`](/api/ratelimit-core/src/type-aliases/keysegment/)[]

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:34](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L34)

Key segments for building rate limit key (default: ['ip'])

***

### policy

> **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:32](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L32)

Rate limit policy

***

### rateLimiter

> **rateLimiter**: [`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:30](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L30)

RateLimiter instance
