---
editUrl: false
next: false
prev: false
title: "LambdaHandler"
---

> **LambdaHandler** = (`event`, `context`) => `Promise`\<[`LambdaResponse`](/api/transports-http/src/interfaces/lambdaresponse/)\>

Defined in: [packages/transports-http/src/libs/types.ts:79](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/types.ts#L79)

transports-http 구성과 실행에 사용되는 핵심 타입 집합입니다.

## Parameters

### event

[`LambdaEvent`](/api/transports-http/src/type-aliases/lambdaevent/)

### context

[`LambdaContext`](/api/transports-http/src/type-aliases/lambdacontext/)

## Returns

`Promise`\<[`LambdaResponse`](/api/transports-http/src/interfaces/lambdaresponse/)\>
