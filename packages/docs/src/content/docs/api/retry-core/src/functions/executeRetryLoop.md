---
editUrl: false
next: false
prev: false
title: "executeRetryLoop"
---

> **executeRetryLoop**\<`T`\>(`callback`, `options`, `hooks?`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryEngine.ts:17](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryEngine.ts#L17)

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

`RetryHooks`

## Returns

`Promise`\<`T`\>
