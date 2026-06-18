---
editUrl: false
next: false
prev: false
title: "TestingTelemetryCapture"
---

## Constructors

### Constructor

> **new TestingTelemetryCapture**(): `TestingTelemetryCapture`

#### Returns

`TestingTelemetryCapture`

## Properties

### spans

> `readonly` **spans**: [`CapturedSpan`](/api/testing/src/type-aliases/capturedspan/)[] = `[]`

## Methods

### reset()

> **reset**(): `void`

#### Returns

`void`

***

### run()

> **run**\<`T`\>(`fn`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T` \| `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
