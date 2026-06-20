---
editUrl: false
next: false
prev: false
title: "IdempotencyExecutionResult"
---

> **IdempotencyExecutionResult**\<`TResult`\> = \{ `outcome`: `"executed"`; `record`: [`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\>; `response`: `TResult`; \} \| \{ `outcome`: `"replayed"`; `record`: [`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\>; `response`: `TResult`; \} \| \{ `outcome`: `"in-flight"`; `record`: [`IdempotencyInFlightRecord`](/api/idempotency-core/src/type-aliases/idempotencyinflightrecord/); \} \| \{ `outcome`: `"failed"`; `record`: [`IdempotencyFailedRecord`](/api/idempotency-core/src/type-aliases/idempotencyfailedrecord/); \}

## Type Parameters

### TResult

`TResult`
