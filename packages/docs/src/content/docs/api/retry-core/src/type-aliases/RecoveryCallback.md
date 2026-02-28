---
editUrl: false
next: false
prev: false
title: "RecoveryCallback"
---

> **RecoveryCallback**\<`T`\> = (`context`) => `T` \| `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:30](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/retry-core/src/libs/RetryTemplate.ts#L30)

Recovery callback for handling exhausted retries.

## Type Parameters

### T

`T`

## Parameters

### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

## Returns

`T` \| `Promise`\<`T`\>
