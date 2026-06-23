---
editUrl: false
next: false
prev: false
title: "runWithLambdaContext"
---

> **runWithLambdaContext**\<`T`\>(`context`, `fn`): `Promise`\<`T`\>

지정한 Lambda 컨텍스트를 현재 비동기 실행 범위에 연결합니다.

## Type Parameters

### T

`T`

## Parameters

### context

[`LambdaContext`](/api/retry-core/src/interfaces/lambdacontext/) \| `null`

### fn

() => `T` \| `Promise`\<`T`\>

## Returns

`Promise`\<`T`\>
