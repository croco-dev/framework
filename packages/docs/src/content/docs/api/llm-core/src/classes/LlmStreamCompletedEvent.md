---
editUrl: false
next: false
prev: false
title: "LlmStreamCompletedEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:4](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L4)

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmStreamCompletedEvent**(`modelId`, `text`, `usage`, `chunkCount?`): `LlmStreamCompletedEvent`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:7](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L7)

#### Parameters

##### modelId

`string`

##### text

`string`

##### usage

[`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

##### chunkCount?

`number`

#### Returns

`LlmStreamCompletedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### chunkCount?

> `readonly` `optional` **chunkCount**: `number`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:11](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L11)

***

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:8](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/events-core/src/libs/DomainEvent.ts#L8)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/events-core/src/libs/DomainEvent.ts#L10)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:8](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L8)

***

### text

> `readonly` **text**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:9](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L9)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/events-core/src/libs/DomainEvent.ts#L9)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.stream_completed"` = `'llm.stream_completed'`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:5](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L5)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:10](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L10)
