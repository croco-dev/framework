---
editUrl: false
next: false
prev: false
title: "TypedLambdaHandler"
---

> **TypedLambdaHandler** = (`event`, `context`) => `Promise`\<\{ `body?`: `string`; `headers?`: `Record`\<`string`, `string`\>; `isBase64Encoded?`: `boolean`; `statusCode`: `number`; \}\>

Defined in: [packages/transports-http/src/libs/CrocoLambdaAdapter.ts:32](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/CrocoLambdaAdapter.ts#L32)

## Parameters

### event

[`LambdaEvent`](/api/transports-http/src/type-aliases/lambdaevent/)

### context

[`LambdaContext`](/api/transports-http/src/type-aliases/lambdacontext/)

## Returns

`Promise`\<\{ `body?`: `string`; `headers?`: `Record`\<`string`, `string`\>; `isBase64Encoded?`: `boolean`; `statusCode`: `number`; \}\>
