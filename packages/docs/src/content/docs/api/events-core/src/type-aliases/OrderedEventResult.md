---
editUrl: false
next: false
prev: false
title: "OrderedEventResult"
---

> **OrderedEventResult** = `object`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:40](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L40)

순서 보장 이벤트 처리 결과입니다.

## Properties

### error?

> `optional` **error**: `Error`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:54](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L54)

에러 (실패한 경우)

***

### eventId

> **eventId**: `string`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:42](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L42)

처리된 이벤트 ID

***

### processedAt

> **processedAt**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:51](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L51)

처리 시간

***

### sequence

> **sequence**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:48](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L48)

처리 순서 (파티션 내에서의 순서)

***

### success

> **success**: `boolean`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:45](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L45)

처리 성공 여부
