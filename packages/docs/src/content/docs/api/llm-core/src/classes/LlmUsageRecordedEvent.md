---
editUrl: false
next: false
prev: false
title: "LlmUsageRecordedEvent"
---

LLM 사용량 기록 이벤트입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmUsageRecordedEvent**(`modelId`, `usage`, `operation`): `LlmUsageRecordedEvent`

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

### operation

> `readonly` **operation**: `"generate"` \| `"stream"` \| `"embed"` \| `"embedMany"` \| `"generateObject"` \| `"callTool"`

***

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.usage_recorded"` = `'llm.usage_recorded'`

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

***

### eventName

> `static` **eventName**: `string` = `'llm.usage_recorded'`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
