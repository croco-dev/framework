---
editUrl: false
next: false
prev: false
title: "LlmStreamCompletedEvent"
---

스트리밍 생성 완료 시 발행되는 이벤트입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmStreamCompletedEvent**(`modelId`, `text`, `usage`, `chunkCount?`, `textTruncated?`): `LlmStreamCompletedEvent`

#### Parameters

##### modelId

`string`

##### text

`string`

##### usage

[`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

##### chunkCount?

`number`

##### textTruncated?

`boolean` = `false`

#### Returns

`LlmStreamCompletedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### chunkCount?

> `readonly` `optional` **chunkCount**: `number`

***

### eventId

> `readonly` **eventId**: `string`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventId`](/api/events-core/src/classes/domainevent/#eventid)

***

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

### text

> `readonly` **text**: `string`

***

### textTruncated

> `readonly` **textTruncated**: `boolean` = `false`

***

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.stream_completed"` = `"llm.stream_completed"`

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

***

### eventName

> `static` **eventName**: `string` = `"llm.stream_completed"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
