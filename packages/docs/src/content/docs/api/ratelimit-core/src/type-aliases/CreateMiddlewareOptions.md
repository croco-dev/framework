---
editUrl: false
next: false
prev: false
title: "CreateMiddlewareOptions"
---

> **CreateMiddlewareOptions** = `object`

HTTP 미들웨어 형태로 레이트 리밋을 적용하는 헬퍼와 타입입니다.

## Properties

### addHeaders?

> `optional` **addHeaders?**: `boolean`

***

### failOpen?

> `optional` **failOpen?**: `boolean`

***

### keySegments?

> `optional` **keySegments?**: `KeySegment`[]

***

### policy

> **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

***

### rateLimiter

> **rateLimiter**: [`RateLimiter`](/api/ratelimit-core/src/classes/ratelimiter/)
