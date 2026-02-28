---
editUrl: false
next: false
prev: false
title: "LlmToolCalledEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:9](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L9)

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmToolCalledEvent**(`modelId`, `toolCall`, `usage`): `LlmToolCalledEvent`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:13](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L13)

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

Defined in: [packages/events-core/src/libs/DomainEvent.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L12)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:14](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L14)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:14](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L14)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:13](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L13)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### toolCall

> `readonly` **toolCall**: [`ToolCall`](/api/llm-core/src/type-aliases/toolcall/)

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:15](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L15)

***

### type

> `readonly` **type**: `"llm.tool_called"` = `'llm.tool_called'`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L10)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:16](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L16)

***

### eventName

> `static` **eventName**: `string` = `'llm.tool_called'`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:11](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L11)

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
