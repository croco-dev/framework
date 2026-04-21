---
editUrl: false
next: false
prev: false
title: "Trace"
---

> **Trace**\<`Args`, `ReturnType`\>(`options?`): (`_target`, `propertyKey`, `descriptor`) => `TypedPropertyDescriptor`\<(...`args`) => `Promise`\<`ReturnType`\>\> \| `undefined`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:34](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-api/src/libs/decorators/Trace.ts#L34)

비동기 메서드 실행을 Span으로 감싸는 데코레이터입니다.

## Type Parameters

### Args

`Args` *extends* `unknown`[] = `unknown`[]

### ReturnType

`ReturnType` = `unknown`

## Parameters

### options?

[`TraceDecoratorOptions`](/api/telemetry-api/src/type-aliases/tracedecoratoroptions/) = `{}`

## Returns

> (`_target`, `propertyKey`, `descriptor`): `TypedPropertyDescriptor`\<(...`args`) => `Promise`\<`ReturnType`\>\> \| `undefined`

### Parameters

#### \_target

`object`

#### propertyKey

`string` | `symbol`

#### descriptor

`TypedPropertyDescriptor`\<(...`args`) => `Promise`\<`ReturnType`\>\>

### Returns

`TypedPropertyDescriptor`\<(...`args`) => `Promise`\<`ReturnType`\>\> \| `undefined`
