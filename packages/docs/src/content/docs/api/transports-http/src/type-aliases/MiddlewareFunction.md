---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<`Response` \| `void`\> \| `Response` \| `void`

## Parameters

### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

### next

() => `Promise`\<`Response` \| `void`\>

## Returns

`Promise`\<`Response` \| `void`\> \| `Response` \| `void`
