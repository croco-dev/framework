---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<[`MiddlewareShortCircuit`](/api/transports-http/src/type-aliases/middlewareshortcircuit/) \| `Response` \| `void`\> \| [`MiddlewareShortCircuit`](/api/transports-http/src/type-aliases/middlewareshortcircuit/) \| `Response` \| `void`

## Parameters

### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

### next

() => `Promise`\<`Response` \| `void`\>

## Returns

`Promise`\<[`MiddlewareShortCircuit`](/api/transports-http/src/type-aliases/middlewareshortcircuit/) \| `Response` \| `void`\> \| [`MiddlewareShortCircuit`](/api/transports-http/src/type-aliases/middlewareshortcircuit/) \| `Response` \| `void`
