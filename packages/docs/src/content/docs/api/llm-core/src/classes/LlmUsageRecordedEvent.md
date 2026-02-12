---
editUrl: false
next: false
prev: false
title: "LlmUsageRecordedEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:4](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L4)

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmUsageRecordedEvent**(`modelId`, `usage`, `operation`): `LlmUsageRecordedEvent`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:7](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L7)

#### Parameters

##### modelId

`string`

##### usage

[`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

##### operation

`"generate"` | `"stream"` | `"embed"` | `"embedMany"` | `"generateObject"` | `"callTool"`

#### Returns

`LlmUsageRecordedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:8](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/events-core/src/libs/DomainEvent.ts#L8)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/events-core/src/libs/DomainEvent.ts#L10)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:8](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L8)

***

### operation

> `readonly` **operation**: `"generate"` \| `"stream"` \| `"embed"` \| `"embedMany"` \| `"generateObject"` \| `"callTool"`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:10](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L10)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/events-core/src/libs/DomainEvent.ts#L9)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.usage_recorded"` = `'llm.usage_recorded'`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:5](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L5)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:9](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L9)
