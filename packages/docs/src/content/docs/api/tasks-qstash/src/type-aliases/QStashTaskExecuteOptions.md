---
editUrl: false
next: false
prev: false
title: "QStashTaskExecuteOptions"
---

> **QStashTaskExecuteOptions** = `object`

QStash 태스크 러너 옵션 타입을 내보냅니다.

## Properties

### delay?

> `optional` **delay**: `number`

이번 요청에만 적용할 지연 시간입니다.

***

### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

이번 요청에만 추가할 헤더입니다.

***

### idempotencyKey?

> `optional` **idempotencyKey**: `string`

QStash publish deduplication id로 전달할 키입니다.
