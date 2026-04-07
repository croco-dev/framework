---
editUrl: false
next: false
prev: false
title: "runWithLambdaContext"
---

> **runWithLambdaContext**\<`T`\>(`context`, `fn`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:18](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L18)

Lambda timeout guard utilities for tracking remaining execution time during retries.

## Type Parameters

### T

`T`

## Parameters

### context

[`LambdaContext`](/api/retry-core/src/interfaces/lambdacontext/) | `null`

### fn

() => `T` \| `Promise`\<`T`\>

## Returns

`Promise`\<`T`\>
