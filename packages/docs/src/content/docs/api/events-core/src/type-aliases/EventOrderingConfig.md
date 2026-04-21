---
editUrl: false
next: false
prev: false
title: "EventOrderingConfig"
---

> **EventOrderingConfig** = `object`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:169](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L169)

순서 보장 설정입니다.

## Properties

### bufferSize?

> `optional` **bufferSize**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:174](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L174)

버퍼 크기 (buffered 전략에서 사용)

***

### flushTimeoutMs?

> `optional` **flushTimeoutMs**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:177](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L177)

Flush 타임아웃 (buffered 전략에서 사용)

***

### maxConcurrency?

> `optional` **maxConcurrency**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:180](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L180)

최대 동시 처리 수 (parallel 전략에서 사용)

***

### partitionKeyExtractor?

> `optional` **partitionKeyExtractor**: [`PartitionKeyExtractor`](/api/events-core/src/type-aliases/partitionkeyextractor/)

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:183](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L183)

파티션 키 추출기

***

### strategy

> **strategy**: [`EventOrderingStrategy`](/api/events-core/src/type-aliases/eventorderingstrategy/)

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:171](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L171)

순서 보장 전략
