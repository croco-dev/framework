---
editUrl: false
next: false
prev: false
title: "createLambdaComposedHandler"
---

> **createLambdaComposedHandler**(`options`): (`event`, `context`) => `Promise`\<`Response`\>

AWS Lambda composed adapter for API routes and page fallback.
Lambda requires buffered responses; streaming responses should be handled before returning from this adapter.

## Parameters

### options

`LambdaComposedOptions`

## Returns

(`event`, `context`) => `Promise`\<`Response`\>
