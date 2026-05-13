---
editUrl: false
next: false
prev: false
title: "PartitionStatus"
---

> **PartitionStatus** = `object`

파티션 상태 정보입니다.

## Properties

### lastProcessedAt?

> `optional` **lastProcessedAt**: `Date`

마지막 처리 시간

***

### lastSequence

> **lastSequence**: `number`

마지막 시퀀스 번호

***

### partitionKey

> **partitionKey**: `string`

파티션 키

***

### pendingCount

> **pendingCount**: `number`

대기 중인 이벤트 수

***

### processingCount

> **processingCount**: `number`

처리 중인 이벤트 수
