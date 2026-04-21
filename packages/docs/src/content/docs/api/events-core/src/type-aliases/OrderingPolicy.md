---
editUrl: false
next: false
prev: false
title: "OrderingPolicy"
---

> **OrderingPolicy** = `object`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L11)

순서 보장 정책입니다.

## Properties

### bufferSize?

> `optional` **bufferSize**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:22](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L22)

순서 보장을 위한 버퍼 크기입니다.
버퍼가 꽉 차면 강제로 flush됩니다.

***

### flushTimeoutMs?

> `optional` **flushTimeoutMs**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L28)

버퍼 flush 타임아웃 (ms)입니다.
이 시간이 지나면 버퍼가 자동으로 flush됩니다.

***

### maxConcurrency?

> `optional` **maxConcurrency**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:34](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L34)

최대 동시 처리 수입니다.
같은 파티션 내에서도 이 개수만큼 병렬로 처리됩니다.

***

### partitionKeyExtractor

> **partitionKeyExtractor**: [`PartitionKeyExtractor`](/api/events-core/src/type-aliases/partitionkeyextractor/)

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:16](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventOrdering.ts#L16)

파티션 키를 추출하는 함수입니다.
같은 파티션 키를 가진 이벤트는 순서가 보장됩니다.
