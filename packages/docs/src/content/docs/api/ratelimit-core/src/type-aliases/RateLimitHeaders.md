---
editUrl: false
next: false
prev: false
title: "RateLimitHeaders"
---

> **RateLimitHeaders** = `object`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:26](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L26)

HTTP 미들웨어 형태로 레이트 리밋을 적용하는 헬퍼와 타입입니다.

## Properties

### Retry-After?

> `optional` **Retry-After**: `string`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:30](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L30)

***

### X-RateLimit-Limit

> **X-RateLimit-Limit**: `string`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:27](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L27)

***

### X-RateLimit-Remaining

> **X-RateLimit-Remaining**: `string`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L28)

***

### X-RateLimit-Reset

> **X-RateLimit-Reset**: `string`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:29](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L29)
