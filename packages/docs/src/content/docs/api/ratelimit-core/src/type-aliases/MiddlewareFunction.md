---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<`void`\> \| `void`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:23](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L23)

Middleware function signature.

## Parameters

### ctx

[`HttpContext`](/api/ratelimit-core/src/interfaces/httpcontext/)

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\> \| `void`
