---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<`void`\> \| `void`

Defined in: [packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts:23](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/ratelimit-core/src/libs/middleware/rateLimitMiddleware.ts#L23)

Middleware function signature.

## Parameters

### ctx

[`HttpContext`](/api/ratelimit-core/src/interfaces/httpcontext/)

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\> \| `void`
