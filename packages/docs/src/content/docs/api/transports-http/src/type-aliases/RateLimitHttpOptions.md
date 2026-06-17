---
editUrl: false
next: false
prev: false
title: "RateLimitHttpOptions"
---

> **RateLimitHttpOptions** = [`CreateMiddlewareOptions`](/api/ratelimit-core/src/type-aliases/createmiddlewareoptions/) & `object`

HTTP 요청에 레이트 리밋 정책을 적용하는 미들웨어 팩토리입니다.

## Type Declaration

### skip?

> `optional` **skip**: `RateLimitSkipPredicate`

### skipFailedRequests?

> `optional` **skipFailedRequests**: `boolean`

### skipSuccessfulRequests?

> `optional` **skipSuccessfulRequests**: `boolean`
