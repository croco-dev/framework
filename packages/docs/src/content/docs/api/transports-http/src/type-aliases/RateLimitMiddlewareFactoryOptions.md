---
editUrl: false
next: false
prev: false
title: "RateLimitMiddlewareFactoryOptions"
---

> **RateLimitMiddlewareFactoryOptions** = `object`

HTTP 요청에 레이트 리밋 정책을 적용하는 미들웨어 팩토리입니다.

## Properties

### clientIdentity?

> `optional` **clientIdentity?**: [`RateLimitClientIdentityPolicy`](/api/transports-http/src/type-aliases/ratelimitclientidentitypolicy/)

***

### defaultPolicy

> **defaultPolicy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

***

### failOpen?

> `optional` **failOpen?**: `boolean`

***

### rateLimiter

> **rateLimiter**: [`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)

***

### skip?

> `optional` **skip?**: `RateLimitSkipPredicate`

***

### skipFailedRequests?

> `optional` **skipFailedRequests?**: `boolean`

***

### skipSuccessfulRequests?

> `optional` **skipSuccessfulRequests?**: `boolean`
