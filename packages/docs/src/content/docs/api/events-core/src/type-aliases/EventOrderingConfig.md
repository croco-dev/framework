---
editUrl: false
next: false
prev: false
title: "EventOrderingConfig"
---

> **EventOrderingConfig** = `object`

순서 보장 설정입니다.

## Properties

### bufferSize?

> `optional` **bufferSize?**: `number`

버퍼 크기 (buffered 전략에서 사용)

---

### flushTimeoutMs?

> `optional` **flushTimeoutMs?**: `number`

Flush 타임아웃 (buffered 전략에서 사용)

---

### maxConcurrency?

> `optional` **maxConcurrency?**: `number`

최대 동시 처리 수 (parallel 전략에서 사용)

---

### partitionKeyExtractor?

> `optional` **partitionKeyExtractor?**: [`PartitionKeyExtractor`](/api/events-core/src/type-aliases/partitionkeyextractor/)

파티션 키 추출기

---

### strategy

> **strategy**: [`EventOrderingStrategy`](/api/events-core/src/type-aliases/eventorderingstrategy/)

순서 보장 전략
