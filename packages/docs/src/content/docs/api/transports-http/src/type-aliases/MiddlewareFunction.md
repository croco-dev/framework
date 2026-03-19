---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<`void`\> \| `void`

Defined in: [packages/transports-http/src/libs/types.ts:24](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/types.ts#L24)

transports-http 구성과 실행에 사용되는 핵심 타입 집합입니다.

## Parameters

### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\> \| `void`
