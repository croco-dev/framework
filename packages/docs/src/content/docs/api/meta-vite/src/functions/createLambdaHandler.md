---
editUrl: false
next: false
prev: false
title: "createLambdaHandler"
---

> **createLambdaHandler**(`handler`): (`event`, `context`) => `Promise`\<`Response`\>

AWS Lambda adapter.
Wraps a CrocoFetchHandler for Lambda API Gateway v2 events.
Lambda uses a buffered Response by default; streaming responses are not supported by this adapter.

## Parameters

### handler

[`CrocoFetchHandler`](/api/meta-vite/src/type-aliases/crocofetchhandler/)

## Returns

(`event`, `context`) => `Promise`\<`Response`\>
