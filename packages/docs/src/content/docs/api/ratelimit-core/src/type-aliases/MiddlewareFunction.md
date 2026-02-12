---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<`void`\> \| `void`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:23](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L23)

Middleware function signature.

## Parameters

### ctx

[`HttpContext`](/api/ratelimit-core/src/interfaces/httpcontext/)

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\> \| `void`
