---
editUrl: false
next: false
prev: false
title: "TypedLambdaHandler"
---

> **TypedLambdaHandler** = (`event`, `context`) => `Promise`\<\{ `body?`: `string`; `headers?`: `Record`\<`string`, `string`\>; `isBase64Encoded?`: `boolean`; `statusCode`: `number`; \}\>

Defined in: [packages/transports-http/src/libs/CrocoLambdaAdapter.ts:32](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/CrocoLambdaAdapter.ts#L32)

Lambda 런타임 이벤트와 컨텍스트를 읽는 유틸리티 및 타입입니다.

## Parameters

### event

[`LambdaEvent`](/api/transports-http/src/type-aliases/lambdaevent/)

### context

[`LambdaContext`](/api/transports-http/src/type-aliases/lambdacontext/)

## Returns

`Promise`\<\{ `body?`: `string`; `headers?`: `Record`\<`string`, `string`\>; `isBase64Encoded?`: `boolean`; `statusCode`: `number`; \}\>
