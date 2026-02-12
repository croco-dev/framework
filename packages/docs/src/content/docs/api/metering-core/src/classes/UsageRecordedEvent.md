---
editUrl: false
next: false
prev: false
title: "UsageRecordedEvent"
---

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:3](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L3)

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new UsageRecordedEvent**(`tenantId`, `meterId`, `value`, `idempotencyKey`, `metadata?`): `UsageRecordedEvent`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:4](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L4)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### value

`number`

##### idempotencyKey

`string`

##### metadata?

`Record`\<`string`, `unknown`\>

#### Returns

`UsageRecordedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:8](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/events-core/src/libs/DomainEvent.ts#L8)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:8](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L8)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/events-core/src/libs/DomainEvent.ts#L10)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### meterId

> `readonly` **meterId**: `string`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:6](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L6)

***

### tenantId

> `readonly` **tenantId**: `string`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:5](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L5)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/events-core/src/libs/DomainEvent.ts#L9)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### value

> `readonly` **value**: `number`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:7](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L7)
