---
editUrl: false
next: false
prev: false
title: "executeRetryLoop"
---

> **executeRetryLoop**\<`T`\>(`callback`, `options`, `hooks?`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryEngine.ts:14](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/RetryEngine.ts#L14)

Low-level retry loop executor used by higher-level retry abstractions.

## Type Parameters

### T

`T`

## Parameters

### callback

() => `Promise`\<`T`\>

### options

#### backoffPolicy

[`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

#### context

[`RetryContext`](/api/retry-core/src/classes/retrycontext/)

#### maxAttempts

`number`

#### retryPolicy

[`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

### hooks?

`RetryHooks`

## Returns

`Promise`\<`T`\>
