---
editUrl: false
next: false
prev: false
title: "ErrorHistoryRingBuffer"
---

고정 크기 원형 버퍼로 ErrorRecord를 저장하는 클래스.

push 연산은 O(1) amortized이며, maxSize 초과 시 가장 오래된 항목이 자동 제거된다.

## Constructors

### Constructor

> **new ErrorHistoryRingBuffer**(`maxSize?`): `ErrorHistoryRingBuffer`

#### Parameters

##### maxSize?

`number` = `100`

#### Returns

`ErrorHistoryRingBuffer`

## Accessors

### maxSize

#### Get Signature

> **get** **maxSize**(): `number`

##### Returns

`number`

***

### size

#### Get Signature

> **get** **size**(): `number`

##### Returns

`number`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

***

### getAll()

> **getAll**(): readonly [`ErrorRecord`](/api/diagnostics-core/src/type-aliases/errorrecord/)[]

#### Returns

readonly [`ErrorRecord`](/api/diagnostics-core/src/type-aliases/errorrecord/)[]

***

### push()

> **push**(`record`): `void`

#### Parameters

##### record

[`ErrorRecord`](/api/diagnostics-core/src/type-aliases/errorrecord/)

#### Returns

`void`
