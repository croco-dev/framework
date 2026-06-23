---
editUrl: false
next: false
prev: false
title: "RetryOrchestratorOptions"
---

> **RetryOrchestratorOptions** = [`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/) & `object`

공용 재시도 오케스트레이터 설정 타입입니다.

## Type Declaration

### backoff?

> `optional` **backoff?**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

### backoffPolicy?

> `optional` **backoffPolicy?**: [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

### listeners?

> `optional` **listeners?**: [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

### maxAttempts?

> `optional` **maxAttempts?**: `number`

### retryPolicy?

> `optional` **retryPolicy?**: [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

### wrapExhausted?

> `optional` **wrapExhausted?**: `boolean`
