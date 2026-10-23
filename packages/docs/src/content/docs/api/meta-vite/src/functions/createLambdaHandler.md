---
editUrl: false
next: false
prev: false
title: "createLambdaHandler"
---

> **createLambdaHandler**(`handler`): (`event`, `context`) => `Promise`\<[`LambdaProxyResponse`](/api/meta-vite/src/type-aliases/lambdaproxyresponse/)\>

AWS Lambda adapter.
Wraps a CrocoFetchHandler for Lambda API Gateway v1/v2 events.
Lambda uses a buffered Response by default; streaming responses are not supported by this adapter.

## Parameters

### handler

[`CrocoFetchHandler`](/api/meta-vite/src/type-aliases/crocofetchhandler/)

## Returns

(`event`, `context`) => `Promise`\<[`LambdaProxyResponse`](/api/meta-vite/src/type-aliases/lambdaproxyresponse/)\>
