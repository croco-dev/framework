---
editUrl: false
next: false
prev: false
title: "AcquireExecutionContinuationResult"
---

> **AcquireExecutionContinuationResult** = `object` & [`ExecutionContinuationAcquired`](/api/execution-core/src/type-aliases/executioncontinuationacquired/) \| `object` & [`ExecutionContinuationAcquired`](/api/execution-core/src/type-aliases/executioncontinuationacquired/) \| \{ `deliveryToken`: `string`; `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `expectedToken?`: `string`; `kind`: `"stale"`; \} \| \{ `claim`: [`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/); `deliveryToken`: `string`; `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `kind`: `"contended"`; \}
