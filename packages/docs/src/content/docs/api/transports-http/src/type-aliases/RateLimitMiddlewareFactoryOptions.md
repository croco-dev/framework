---
editUrl: false
next: false
prev: false
title: "RateLimitMiddlewareFactoryOptions"
---

> **RateLimitMiddlewareFactoryOptions** = `object`

Defined in: [packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts:71](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts#L71)

HTTP 요청에 레이트 리밋 정책을 적용하는 미들웨어 팩토리입니다.

## Properties

### defaultPolicy

> **defaultPolicy**: `RateLimitPolicy`

Defined in: [packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts:73](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts#L73)

***

### rateLimiter

> **rateLimiter**: `RateLimiter`

Defined in: [packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts:72](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts#L72)

***

### skipFailedRequests?

> `optional` **skipFailedRequests**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts:75](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts#L75)

***

### skipSuccessfulRequests?

> `optional` **skipSuccessfulRequests**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts:74](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts#L74)
