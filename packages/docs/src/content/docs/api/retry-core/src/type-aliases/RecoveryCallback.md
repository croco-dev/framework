---
editUrl: false
next: false
prev: false
title: "RecoveryCallback"
---

> **RecoveryCallback**\<`T`\> = (`context`) => `T` \| `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:31](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/RetryTemplate.ts#L31)

Recovery callback for handling exhausted retries.

## Type Parameters

### T

`T`

## Parameters

### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

## Returns

`T` \| `Promise`\<`T`\>
