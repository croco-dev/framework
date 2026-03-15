---
editUrl: false
next: false
prev: false
title: "RetryOrchestratorOptions"
---

> **RetryOrchestratorOptions** = [`RetryPolicyOptions`](/api/retry-core/src/interfaces/retrypolicyoptions/) & `object`

Defined in: [packages/retry-core/src/libs/RetryOrchestrator.ts:8](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/RetryOrchestrator.ts#L8)

Options for configuring the shared retry orchestrator.

## Type Declaration

### backoff?

> `optional` **backoff**: [`BackoffOptions`](/api/retry-core/src/interfaces/backoffoptions/)

### backoffPolicy?

> `optional` **backoffPolicy**: [`BackoffPolicy`](/api/retry-core/src/interfaces/backoffpolicy/)

### listeners?

> `optional` **listeners**: [`RetryListener`](/api/retry-core/src/interfaces/retrylistener/)[]

### maxAttempts?

> `optional` **maxAttempts**: `number`

### retryPolicy?

> `optional` **retryPolicy**: [`RetryPolicy`](/api/retry-core/src/interfaces/retrypolicy/)

### wrapExhausted?

> `optional` **wrapExhausted**: `boolean`
