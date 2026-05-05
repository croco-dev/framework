---
editUrl: false
next: false
prev: false
title: "createRateLimitMiddlewareFactory"
---

> **createRateLimitMiddlewareFactory**(`options`): (`policyOverride?`) => [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

기본 정책을 캡슐화한 레이트 리밋 미들웨어 팩토리를 생성합니다.

## Parameters

### options

[`RateLimitMiddlewareFactoryOptions`](/api/transports-http/src/type-aliases/ratelimitmiddlewarefactoryoptions/)

## Returns

> (`policyOverride?`): [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

### Parameters

#### policyOverride?

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

### Returns

[`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)
