---
editUrl: false
next: false
prev: false
title: "executeRetryLoop"
---

> **executeRetryLoop**\<`T`\>(`callback`, `options`, `hooks?`): `Promise`\<`T`\>

재시도 정책과 백오프 정책을 따라 저수준 재시도 루프를 실행합니다.

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

[`RetryHooks`](/api/retry-core/src/interfaces/retryhooks/)

## Returns

`Promise`\<`T`\>
