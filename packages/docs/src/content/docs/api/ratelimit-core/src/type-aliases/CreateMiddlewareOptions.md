---
editUrl: false
next: false
prev: false
title: "CreateMiddlewareOptions"
---

> **CreateMiddlewareOptions** = `object`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:18](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L18)

HTTP 미들웨어 형태로 레이트 리밋을 적용하는 헬퍼와 타입입니다.

## Properties

### addHeaders?

> `optional` **addHeaders**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:23](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L23)

***

### failOpen?

> `optional` **failOpen**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:22](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L22)

***

### keySegments?

> `optional` **keySegments**: `KeySegment`[]

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:21](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L21)

***

### policy

> **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L20)

***

### rateLimiter

> **rateLimiter**: [`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L19)
