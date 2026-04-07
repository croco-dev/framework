---
editUrl: false
next: false
prev: false
title: "OrderedEventContext"
---

> **OrderedEventContext** = `object`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:144](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L144)

순서 보장 이벤트 처리 컨텍스트입니다.

## Properties

### hasNext

> **hasNext**: `boolean`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:155](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L155)

다음 이벤트 존재 여부

***

### hasPrevious

> **hasPrevious**: `boolean`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:152](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L152)

이전 이벤트 처리 여부

***

### partitionKey

> **partitionKey**: `string`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:146](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L146)

파티션 키

***

### sequence

> **sequence**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:149](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L149)

파티션 내 시퀀스 번호

***

### startedAt

> **startedAt**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:158](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L158)

처리 시작 시간
