---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<`void`\> \| `void`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:23](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L23)

Middleware function signature.

## Parameters

### ctx

[`HttpContext`](/api/ratelimit-core/src/interfaces/httpcontext/)

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\> \| `void`
