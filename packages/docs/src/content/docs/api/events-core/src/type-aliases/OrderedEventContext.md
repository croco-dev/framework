---
editUrl: false
next: false
prev: false
title: "OrderedEventContext"
---

> **OrderedEventContext** = `object`

순서 보장 이벤트 처리 컨텍스트입니다.

## Properties

### hasNext

> **hasNext**: `boolean`

다음 이벤트 존재 여부

***

### hasPrevious

> **hasPrevious**: `boolean`

이전 이벤트 처리 여부

***

### partitionKey

> **partitionKey**: `string`

파티션 키

***

### sequence

> **sequence**: `number`

파티션 내 시퀀스 번호

***

### startedAt

> **startedAt**: `Date`

처리 시작 시간
