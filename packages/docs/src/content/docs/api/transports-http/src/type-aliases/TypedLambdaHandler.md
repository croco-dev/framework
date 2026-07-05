---
editUrl: false
next: false
prev: false
title: "TypedLambdaHandler"
---

> **TypedLambdaHandler** = (`event`, `context`) => `Promise`\<\{ `body?`: `string`; `cookies?`: `string`[]; `headers?`: `Record`\<`string`, `string`\>; `isBase64Encoded?`: `boolean`; `statusCode`: `number`; \}\>

Lambda 런타임 이벤트와 컨텍스트를 읽는 유틸리티, 타입, 그리고 Hono 앱을 Lambda 핸들러로 변환하는 어댑터 클래스입니다.

## Parameters

### event

[`LambdaEvent`](/api/preset-lambda/src/type-aliases/lambdaevent/)

### context

[`LambdaContext`](/api/preset-lambda/src/type-aliases/lambdacontext/)

## Returns

`Promise`\<\{ `body?`: `string`; `cookies?`: `string`[]; `headers?`: `Record`\<`string`, `string`\>; `isBase64Encoded?`: `boolean`; `statusCode`: `number`; \}\>
