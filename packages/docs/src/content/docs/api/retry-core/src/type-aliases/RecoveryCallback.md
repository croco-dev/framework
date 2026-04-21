---
editUrl: false
next: false
prev: false
title: "RecoveryCallback"
---

> **RecoveryCallback**\<`T`\> = (`context`) => `T` \| `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:31](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryTemplate.ts#L31)

Recovery callback for handling exhausted retries.

## Type Parameters

### T

`T`

## Parameters

### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

## Returns

`T` \| `Promise`\<`T`\>
