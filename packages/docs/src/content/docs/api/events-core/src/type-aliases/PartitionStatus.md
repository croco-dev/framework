---
editUrl: false
next: false
prev: false
title: "PartitionStatus"
---

> **PartitionStatus** = `object`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:60](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L60)

파티션 상태 정보입니다.

## Properties

### lastProcessedAt?

> `optional` **lastProcessedAt**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:71](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L71)

마지막 처리 시간

***

### lastSequence

> **lastSequence**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:74](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L74)

마지막 시퀀스 번호

***

### partitionKey

> **partitionKey**: `string`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:62](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L62)

파티션 키

***

### pendingCount

> **pendingCount**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:65](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L65)

대기 중인 이벤트 수

***

### processingCount

> **processingCount**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:68](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L68)

처리 중인 이벤트 수
