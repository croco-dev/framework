---
editUrl: false
next: false
prev: false
title: "LlmGeneratedEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:4](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L4)

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmGeneratedEvent**(`modelId`, `prompt`, `result`, `usage`): `LlmGeneratedEvent`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:7](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L7)

#### Parameters

##### modelId

`string`

##### prompt

`string`

##### result

`string`

##### usage

[`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

#### Returns

`LlmGeneratedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:8](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/events-core/src/libs/DomainEvent.ts#L8)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/events-core/src/libs/DomainEvent.ts#L10)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:8](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L8)

***

### prompt

> `readonly` **prompt**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:9](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L9)

***

### result

> `readonly` **result**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:10](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L10)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/events-core/src/libs/DomainEvent.ts#L9)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.generated"` = `'llm.generated'`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:5](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L5)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:11](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L11)
