---
editUrl: false
next: false
prev: false
title: "MiddlewareFunction"
---

> **MiddlewareFunction** = (`ctx`, `next`) => `Promise`\<`void`\> \| `void`

Defined in: [packages/transports-http/src/libs/types.ts:18](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/transports-http/src/libs/types.ts#L18)

transports-http 구성과 실행에 사용되는 핵심 타입 집합입니다.

## Parameters

### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

### next

() => `Promise`\<`void`\>

## Returns

`Promise`\<`void`\> \| `void`
