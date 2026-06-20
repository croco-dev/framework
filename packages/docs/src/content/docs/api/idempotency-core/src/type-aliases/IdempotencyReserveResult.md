---
editUrl: false
next: false
prev: false
title: "IdempotencyReserveResult"
---

> **IdempotencyReserveResult**\<`TResult`\> = \{ `outcome`: `"reserved"`; `record`: [`IdempotencyInFlightRecord`](/api/idempotency-core/src/type-aliases/idempotencyinflightrecord/); `reservation`: [`IdempotencyReservation`](/api/idempotency-core/src/type-aliases/idempotencyreservation/); \} \| \{ `outcome`: `"replay"`; `record`: [`IdempotencyCompletedRecord`](/api/idempotency-core/src/type-aliases/idempotencycompletedrecord/)\<`TResult`\>; `response`: `TResult`; \} \| \{ `outcome`: `"in-flight"`; `record`: [`IdempotencyInFlightRecord`](/api/idempotency-core/src/type-aliases/idempotencyinflightrecord/); \} \| \{ `outcome`: `"failed"`; `record`: [`IdempotencyFailedRecord`](/api/idempotency-core/src/type-aliases/idempotencyfailedrecord/); \}

## Type Parameters

### TResult

`TResult` = `unknown`
