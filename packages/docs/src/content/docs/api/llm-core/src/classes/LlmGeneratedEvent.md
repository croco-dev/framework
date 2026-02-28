---
editUrl: false
next: false
prev: false
title: "LlmGeneratedEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:4](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L4)

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmGeneratedEvent**(`modelId`, `prompt`, `result`, `usage`): `LlmGeneratedEvent`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:8](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L8)

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

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:9](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L9)

***

### prompt

> `readonly` **prompt**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:10](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L10)

***

### result

> `readonly` **result**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:11](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L11)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:13](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/DomainEvent.ts#L13)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.generated"` = `'llm.generated'`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:6](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L6)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L12)

***

### eventName

> `static` **eventName**: `string` = `'llm.generated'`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:5](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L5)

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
