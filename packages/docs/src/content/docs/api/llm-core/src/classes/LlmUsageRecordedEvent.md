---
editUrl: false
next: false
prev: false
title: "LlmUsageRecordedEvent"
---

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:4](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L4)

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmUsageRecordedEvent**(`modelId`, `usage`, `operation`): `LlmUsageRecordedEvent`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:8](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L8)

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

Defined in: [packages/events-core/src/libs/DomainEvent.ts:18](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/DomainEvent.ts#L18)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:20](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/DomainEvent.ts#L20)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### modelId

> `readonly` **modelId**: `string`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:9](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L9)

***

### operation

> `readonly` **operation**: `"generate"` \| `"stream"` \| `"embed"` \| `"embedMany"` \| `"generateObject"` \| `"callTool"`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:11](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L11)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:19](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/DomainEvent.ts#L19)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### type

> `readonly` **type**: `"llm.usage_recorded"` = `'llm.usage_recorded'`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:5](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L5)

***

### usage

> `readonly` **usage**: [`LlmUsage`](/api/llm-core/src/type-aliases/llmusage/)

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:10](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L10)

***

### eventName

> `static` **eventName**: `string` = `'llm.usage_recorded'`

Defined in: [packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts:6](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/llm-core/src/libs/events/LlmUsageRecordedEvent.ts#L6)

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
