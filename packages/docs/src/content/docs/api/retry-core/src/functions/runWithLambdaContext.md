---
editUrl: false
next: false
prev: false
title: "runWithLambdaContext"
---

> **runWithLambdaContext**\<`T`\>(`context`, `fn`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:21](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L21)

지정한 Lambda 컨텍스트를 현재 비동기 실행 범위에 연결합니다.

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
