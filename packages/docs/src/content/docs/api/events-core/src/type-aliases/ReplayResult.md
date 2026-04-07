---
editUrl: false
next: false
prev: false
title: "ReplayResult"
---

> **ReplayResult** = `object`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:37](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L37)

리플레이된 이벤트의 결과입니다.

## Properties

### completedAt

> **completedAt**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:54](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L54)

종료 시간

***

### failedCount

> **failedCount**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:45](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L45)

실패한 이벤트 수

***

### failedEventIds

> **failedEventIds**: `string`[]

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:48](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L48)

실패한 이벤트 ID 목록

***

### processedCount

> **processedCount**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:39](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L39)

처리된 이벤트 수

***

### startedAt

> **startedAt**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:51](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L51)

시작 시간

***

### successCount

> **successCount**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:42](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L42)

성공한 이벤트 수
