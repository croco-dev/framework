---
editUrl: false
next: false
prev: false
title: "DomainEvent"
---

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L9)

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

Defined in: [packages/events-core/src/libs/DomainEvent.ts:16](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L16)

#### Returns

`DomainEvent`

## Properties

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L12)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:14](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L14)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:13](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L13)

***

### eventName?

> `static` `optional` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L10)
