---
editUrl: false
next: false
prev: false
title: "DomainEvent"
---

Defined in: [packages/events-core/src/libs/DomainEvent.ts:8](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/DomainEvent.ts#L8)

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

Defined in: [packages/events-core/src/libs/DomainEvent.ts:13](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/DomainEvent.ts#L13)

#### Returns

`DomainEvent`

## Properties

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/DomainEvent.ts#L9)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:11](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/DomainEvent.ts#L11)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/DomainEvent.ts#L10)
