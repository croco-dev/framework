---
editUrl: false
next: false
prev: false
title: "LlmToolCalledEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L9)

도구 호출 이벤트와 도구 호출 정보 타입입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmToolCalledEvent**(`modelId`, `toolCall`, `usage`): `LlmToolCalledEvent`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L13)

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

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:14](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L14)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/DomainEvent.ts#L19)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### toolCall

> `readonly` **toolCall**: [`ToolCall`](/api/llm-core/src/type-aliases/toolcall/)

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:15](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L15)

***

### type

> `readonly` **type**: `"llm.tool_called"` = `'llm.tool_called'`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L10)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:16](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L16)

***

### eventName

> `static` **eventName**: `string` = `'llm.tool_called'`

Defined in: [packages/llm-core/src/libs/events/LlmToolCalledEvent.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/llm-core/src/libs/events/LlmToolCalledEvent.ts#L11)

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
