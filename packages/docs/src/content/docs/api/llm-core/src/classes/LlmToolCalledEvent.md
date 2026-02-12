---
editUrl: false
next: false
prev: false
title: "LlmToolCalledEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:9](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L9)

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmToolCalledEvent**(`modelId`, `toolCall`, `usage`): `LlmToolCalledEvent`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:12](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L12)

#### Parameters

##### modelId

`string`

##### toolCall

[`ToolCall`](/api/llm-core/src/type-aliases/toolcall/)

##### usage

[`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

#### Returns

`LlmToolCalledEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:8](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/DomainEvent.ts#L8)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/DomainEvent.ts#L10)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:13](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L13)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/DomainEvent.ts#L9)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### toolCall

> `readonly` **toolCall**: [`ToolCall`](/api/llm-core/src/type-aliases/toolcall/)

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:14](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L14)

***

### type

> `readonly` **type**: `"llm.tool_called"` = `'llm.tool_called'`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:10](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L10)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:15](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L15)
