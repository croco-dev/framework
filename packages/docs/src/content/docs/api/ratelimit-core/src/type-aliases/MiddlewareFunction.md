---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<`void`\> \| `void`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:23](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L23)

Middleware function signature.

## Parameters

### ctx

[`HttpContext`](/api/ratelimit-core/src/interfaces/httpcontext/)

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\> \| `void`
