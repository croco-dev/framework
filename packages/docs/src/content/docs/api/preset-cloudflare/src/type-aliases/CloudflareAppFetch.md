---
editUrl: false
next: false
prev: false
title: "CloudflareAppFetch"
---

> **CloudflareAppFetch**\<`TExecutionContext`\> = (`request`, `runtimeContext?`, `options?`) => `Response` \| `Promise`\<`Response`\>

## Type Parameters

### TExecutionContext

`TExecutionContext` _extends_ `ExecutionContext` = `ExecutionContext`

## Parameters

### request

`Request`

### runtimeContext?

[`CloudflareRuntimeContext`](/api/preset-cloudflare/src/type-aliases/cloudflareruntimecontext/)

### options?

#### env?

[`CloudflareFetchEnv`](/api/preset-cloudflare/src/type-aliases/cloudflarefetchenv/)

#### executionContext?

`TExecutionContext`

## Returns

`Response` \| `Promise`\<`Response`\>
