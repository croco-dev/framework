---
editUrl: false
next: false
prev: false
title: "ClaimExecutionContinuationResult"
---

> **ClaimExecutionContinuationResult** = \{ `claim`: [`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/); `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `kind`: `"process"`; \} \| \{ `claim`: [`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/); `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `kind`: `"publish_pending"`; `publication`: [`ExecutionContinuationPublication`](/api/execution-core/src/interfaces/executioncontinuationpublication/); \} \| \{ `deliveryToken`: `string`; `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `expectedToken?`: `string`; `kind`: `"stale"`; \} \| \{ `claim`: [`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/); `deliveryToken`: `string`; `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `kind`: `"contended"`; \}
