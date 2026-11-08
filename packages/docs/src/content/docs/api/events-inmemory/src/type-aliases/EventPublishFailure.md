---
editUrl: false
next: false
prev: false
title: "EventPublishFailure"
---

> **EventPublishFailure** = `object`

인메모리 이벤트 버스의 동시성 제어 전략과 옵션 타입입니다.

## Properties

### error

> **error**: `Error`

Original execution failure; retained when dead-letter storage also fails.

---

### handlerName

> **handlerName**: `string`

---

### item?

> `optional` **item?**: [`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)

Failed enqueue item for caller-owned recovery. Contains event payload.

---

### storageError?

> `optional` **storageError?**: `Error`

Dead-letter enqueue failure, separate from the execution failure.
