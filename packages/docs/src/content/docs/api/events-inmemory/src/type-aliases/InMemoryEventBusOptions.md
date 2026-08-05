---
editUrl: false
next: false
prev: false
title: "InMemoryEventBusOptions"
---

> **InMemoryEventBusOptions** = `object`

인메모리 이벤트 버스의 동시성 제어 전략과 옵션 타입입니다.

## Properties

### backpressureStrategy?

> `optional` **backpressureStrategy?**: [`BackpressureStrategy`](/api/events-inmemory/src/type-aliases/backpressurestrategy/)

***

### backpressureTimeoutMs?

> `optional` **backpressureTimeoutMs?**: `number`

Integer milliseconds from 1 through 2,147,483,647. Defaults to 5000.

***

### maxConcurrency?

> `optional` **maxConcurrency?**: `number`

Positive safe integer. Defaults to 100.
