---
editUrl: false
next: false
prev: false
title: "Trace"
---

> **Trace**\<`Args`, `ReturnType`\>(`options?`): (`_target`, `propertyKey`, `descriptor`) => `PropertyDescriptor` \| `undefined`

비동기 메서드 실행을 Span으로 감싸는 데코레이터입니다.

## Type Parameters

### Args

`Args` _extends_ `unknown`[] = `unknown`[]

### ReturnType

`ReturnType` = `unknown`

## Parameters

### options?

[`TraceDecoratorOptions`](/api/telemetry-api/src/type-aliases/tracedecoratoroptions/) = `{}`

## Returns

(`_target`, `propertyKey`, `descriptor`) => `PropertyDescriptor` \| `undefined`
