---
editUrl: false
next: false
prev: false
title: "LlmGeneratedEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L4)

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmGeneratedEvent**(`modelId`, `prompt`, `result`, `usage`): `LlmGeneratedEvent`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L8)

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

Defined in: [packages/events-core/src/libs/DomainEvent.ts:18](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/DomainEvent.ts#L18)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:20](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/DomainEvent.ts#L20)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L9)

***

### prompt

> `readonly` **prompt**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:10](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L10)

***

### result

> `readonly` **result**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:11](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L11)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:19](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/DomainEvent.ts#L19)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.generated"` = `'llm.generated'`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:6](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L6)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:12](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L12)

***

### eventName

> `static` **eventName**: `string` = `'llm.generated'`

Defined in: [packages/llm-core/src/libs/events/LlmGeneratedEvent.ts:5](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/llm-core/src/libs/events/LlmGeneratedEvent.ts#L5)

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
