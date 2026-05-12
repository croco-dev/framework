---
editUrl: false
next: false
prev: false
title: "DomainEvent"
---

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extended by

- [`QuotaExceededEvent`](/api/metering-core/src/classes/quotaexceededevent/)
- [`UsageRecordedEvent`](/api/metering-core/src/classes/usagerecordedevent/)
- [`LlmGeneratedEvent`](/api/llm-core/src/classes/llmgeneratedevent/)
- [`LlmStreamCompletedEvent`](/api/llm-core/src/classes/llmstreamcompletedevent/)
- [`LlmToolCalledEvent`](/api/llm-core/src/classes/llmtoolcalledevent/)
- [`LlmUsageRecordedEvent`](/api/llm-core/src/classes/llmusagerecordedevent/)

## Constructors

### Constructor

> **new DomainEvent**(): `DomainEvent`

#### Returns

`DomainEvent`

## Properties

### eventId

> `readonly` **eventId**: `string`

---

### eventName

> `readonly` **eventName**: `string`

---

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

---

### timestamp

> `readonly` **timestamp**: `Date`

---

### eventName?

> `static` `optional` **eventName**: `string`
