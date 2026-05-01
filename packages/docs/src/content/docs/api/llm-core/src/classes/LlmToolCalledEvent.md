---
editUrl: false
next: false
prev: false
title: "LlmToolCalledEvent"
---

도구 호출 이벤트와 도구 호출 정보 타입입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmToolCalledEvent**(`modelId`, `toolCall`, `usage`): `LlmToolCalledEvent`

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

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

***

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### toolCall

> `readonly` **toolCall**: [`ToolCall`](/api/llm-core/src/type-aliases/toolcall/)

***

### type

> `readonly` **type**: `"llm.tool_called"` = `'llm.tool_called'`

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

***

### eventName

> `static` **eventName**: `string` = `'llm.tool_called'`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
