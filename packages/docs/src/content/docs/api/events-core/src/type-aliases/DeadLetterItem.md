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

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Properties

### event

> **event**: `TEvent`

원본 이벤트

---

### failedAt

> **failedAt**: `Date`

실패 시간

---

### handlerId?

> `optional` **handlerId?**: `string`

재생 시 같은 핸들러를 식별할 수 있는 안정적인 핸들러 식별자

---

### lastError?

> `optional` **lastError?**: `string`

Payload를 포함하지 않는 마지막 오류 분류

---

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

이벤트 payload를 포함하지 않는 진단·보관 메타데이터

---

### reason

> **reason**: `string`

Payload를 포함하지 않는 안정적인 실패 원인 코드

---

### retryCount

> **retryCount**: `number`

재시도 횟수
