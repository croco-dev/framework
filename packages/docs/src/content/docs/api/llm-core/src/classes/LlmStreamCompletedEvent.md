---
editUrl: false
next: false
prev: false
title: "LlmStreamCompletedEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L4)

스트리밍 생성 완료 시 발행되는 이벤트입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmStreamCompletedEvent**(`modelId`, `text`, `usage`, `chunkCount?`): `LlmStreamCompletedEvent`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L8)

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

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:12](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L12)

***

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:18](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/DomainEvent.ts#L18)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/DomainEvent.ts#L20)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L9)

***

### text

> `readonly` **text**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L10)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/DomainEvent.ts#L19)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.stream_completed"` = `'llm.stream_completed'`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L6)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L11)

***

### eventName

> `static` **eventName**: `string` = `'llm.stream_completed'`

Defined in: [packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmStreamCompletedEvent.ts#L5)

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
