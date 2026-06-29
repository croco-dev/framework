---
editUrl: false
next: false
prev: false
title: "DeadLetterItem"
---

> **DeadLetterItem**\<`TEvent`\> = `object`

죽은 편지 큐(DLQ)에 저장된 이벤트 항목입니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Properties

### event

> **event**: `TEvent`

원본 이벤트

***

### failedAt

> **failedAt**: `Date`

실패 시간

***

### handlerId?

> `optional` **handlerId?**: `string`

핸들러 식별자 (어떤 핸들러에서 실패했는지)

***

### lastError?

> `optional` **lastError?**: `string`

마지막 에러 메시지

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

추가 메타데이터

***

### reason

> **reason**: `string`

실패 원인

***

### retryCount

> **retryCount**: `number`

재시도 횟수
