---
editUrl: false
next: false
prev: false
title: "ReplayOptions"
---

> **ReplayOptions** = `object`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:11](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L11)

이벤트 리플레이 옵션입니다.

## Properties

### batchSize?

> `optional` **batchSize**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:28](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L28)

배치 크기

***

### eventTypes?

> `optional` **eventTypes**: `string`[]

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:19](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L19)

특정 이벤트 타입만 리플레이

***

### from?

> `optional` **from**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:13](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L13)

시작 시간

***

### mode?

> `optional` **mode**: [`ReplayMode`](/api/events-core/src/type-aliases/replaymode/)

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L25)

리플레이 모드 (fast: 속도 우선, accurate: 정확성 우선)

***

### onProgress()?

> `optional` **onProgress**: (`processed`, `total`) => `void`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:31](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L31)

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

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:22](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L22)

특정 파티션 키만 리플레이

***

### to?

> `optional` **to**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:16](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L16)

종료 시간
