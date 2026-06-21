---
editUrl: false
next: false
prev: false
title: "createIdempotentHandler"
---

> **createIdempotentHandler**\<`TContext`, `TResult`\>(`coordinator`, `resolveRequest`, `handler`): (`context`) => `Promise`\<[`IdempotencyExecutionResult`](/api/idempotency-core/src/type-aliases/idempotencyexecutionresult/)\<`TResult`\>\>

## Type Parameters

### TContext

`TContext`

### TResult

`TResult`

## Parameters

### coordinator

[`IdempotencyCoordinator`](/api/idempotency-core/src/classes/idempotencycoordinator/)\<`TResult`\>

### resolveRequest

(`context`) => [`IdempotencyExecutionRequest`](/api/idempotency-core/src/type-aliases/idempotencyexecutionrequest/)

### handler

(`context`) => `TResult` \| `Promise`\<`TResult`\>

## Returns

> (`context`): `Promise`\<[`IdempotencyExecutionResult`](/api/idempotency-core/src/type-aliases/idempotencyexecutionresult/)\<`TResult`\>\>

### Parameters

#### context

`TContext`

### Returns

`Promise`\<[`IdempotencyExecutionResult`](/api/idempotency-core/src/type-aliases/idempotencyexecutionresult/)\<`TResult`\>\>
