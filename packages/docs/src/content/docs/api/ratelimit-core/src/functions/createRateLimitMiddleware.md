---
editUrl: false
next: false
prev: false
title: "createRateLimitMiddleware"
---

> **createRateLimitMiddleware**(`options`): [`MiddlewareFunction`](/api/ratelimit-core/src/type-aliases/middlewarefunction/)

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:64](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L64)

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
