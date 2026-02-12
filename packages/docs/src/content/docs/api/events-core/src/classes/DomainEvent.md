---
editUrl: false
next: false
prev: false
title: "DomainEvent"
---

Defined in: [packages/events-core/src/libs/DomainEvent.ts:7](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/DomainEvent.ts#L7)

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

Defined in: [packages/events-core/src/libs/DomainEvent.ts:12](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/DomainEvent.ts#L12)

#### Returns

`DomainEvent`

## Properties

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:8](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/DomainEvent.ts#L8)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/DomainEvent.ts#L10)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/DomainEvent.ts#L9)
