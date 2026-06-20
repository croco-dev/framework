---
editUrl: false
next: false
prev: false
title: "IdempotencyCoordinator"
---

## Type Parameters

### TResult

`TResult` = `unknown`

## Constructors

### Constructor

> **new IdempotencyCoordinator**\<`TResult`\>(`options`): `IdempotencyCoordinator`\<`TResult`\>

#### Parameters

##### options

[`IdempotencyCoordinatorOptions`](/api/idempotency-core/src/type-aliases/idempotencycoordinatoroptions/)\<`TResult`\>

#### Returns

`IdempotencyCoordinator`\<`TResult`\>

## Methods

### execute()

> **execute**(`request`, `handler`): `Promise`\<[`IdempotencyExecutionResult`](/api/idempotency-core/src/type-aliases/idempotencyexecutionresult/)\<`TResult`\>\>

#### Parameters

##### request

[`IdempotencyExecutionRequest`](/api/idempotency-core/src/type-aliases/idempotencyexecutionrequest/)

##### handler

[`IdempotencyHandler`](/api/idempotency-core/src/type-aliases/idempotencyhandler/)\<`TResult`\>

#### Returns

`Promise`\<[`IdempotencyExecutionResult`](/api/idempotency-core/src/type-aliases/idempotencyexecutionresult/)\<`TResult`\>\>
