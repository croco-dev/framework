---
editUrl: false
next: false
prev: false
title: "createRateLimitMiddleware"
---

> **createRateLimitMiddleware**(`options`): [`MiddlewareFunction`](/api/ratelimit-core/src/type-aliases/middlewarefunction/)

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:64](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L64)

Creates a rate limiting middleware for global application.

## Parameters

### options

[`CreateMiddlewareOptions`](/api/ratelimit-core/src/type-aliases/createmiddlewareoptions/)

## Returns

[`MiddlewareFunction`](/api/ratelimit-core/src/type-aliases/middlewarefunction/)

## Example

```typescript
const middleware = createRateLimitMiddleware({
  rateLimiter,
  policy: { name: 'global', limit: 1000, windowMs: 3600000 },
  keySegments: ['tenant', 'ip'],
});

// In CrocoApp config
{ middlewares: [middleware] }
```
