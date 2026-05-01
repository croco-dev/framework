---
editUrl: false
next: false
prev: false
title: "ReplayOptions"
---

> **ReplayOptions** = `object`

이벤트 리플레이 옵션입니다.

## Properties

### batchSize?

> `optional` **batchSize**: `number`

배치 크기

***

### eventTypes?

> `optional` **eventTypes**: `string`[]

특정 이벤트 타입만 리플레이

***

### from?

> `optional` **from**: `Date`

시작 시간

***

### mode?

> `optional` **mode**: [`ReplayMode`](/api/events-core/src/type-aliases/replaymode/)

리플레이 모드 (fast: 속도 우선, accurate: 정확성 우선)

***

### onProgress()?

> `optional` **onProgress**: (`processed`, `total`) => `void`

진행 상황 콜백

#### Parameters

##### processed

`number`

##### total

`number`

#### Returns

`void`

***

### partitionKeys?

> `optional` **partitionKeys**: `string`[]

특정 파티션 키만 리플레이

***

### to?

> `optional` **to**: `Date`

종료 시간
