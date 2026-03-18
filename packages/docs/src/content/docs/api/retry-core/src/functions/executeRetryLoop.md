---
editUrl: false
next: false
prev: false
title: "executeRetryLoop"
---

> **executeRetryLoop**\<`T`\>(`callback`, `options`, `hooks?`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryEngine.ts:14](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/RetryEngine.ts#L14)

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
