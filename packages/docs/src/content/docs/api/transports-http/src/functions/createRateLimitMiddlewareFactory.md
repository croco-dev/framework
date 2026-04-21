---
editUrl: false
next: false
prev: false
title: "createRateLimitMiddlewareFactory"
---

> **createRateLimitMiddlewareFactory**(`options`): (`policyOverride?`) => [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

Defined in: [packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts:81](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/RateLimitMiddleware.ts#L81)

기본 정책을 캡슐화한 레이트 리밋 미들웨어 팩토리를 생성합니다.

## Parameters

### options

[`RateLimitMiddlewareFactoryOptions`](/api/transports-http/src/type-aliases/ratelimitmiddlewarefactoryoptions/)

## Returns

> (`policyOverride?`): [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

### Parameters

#### policyOverride?

`RateLimitPolicy`

### Returns

[`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)
