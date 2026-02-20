---
editUrl: false
next: false
prev: false
title: "withSpan"
---

> **withSpan**\<`T`\>(`fn`, `options?`): `Promise`\<`T`\>

Defined in: [packages/telemetry-api/src/libs/span.ts:22](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/telemetry-api/src/libs/span.ts#L22)

함수 실행을 Span으로 감싸고 자동으로 추적합니다.

## Type Parameters

### T

`T`

## Parameters

### fn

(`span`) => `T` \| `Promise`\<`T`\>

실행할 함수

### options?

[`SpanOptions`](/api/telemetry-api/src/type-aliases/spanoptions/) = `{}`

Span 옵션

## Returns

`Promise`\<`T`\>

함수 실행 결과
