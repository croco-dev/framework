---
editUrl: false
next: false
prev: false
title: "QuotaExceededEvent"
---

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:3](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L3)

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new QuotaExceededEvent**(`tenantId`, `meterId`, `currentUsage`, `quota`): `QuotaExceededEvent`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:4](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L4)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### currentUsage

`number`

##### quota

`number`

#### Returns

`QuotaExceededEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### currentUsage

> `readonly` **currentUsage**: `number`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:7](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L7)

***

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:8](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/events-core/src/libs/DomainEvent.ts#L8)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:10](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/events-core/src/libs/DomainEvent.ts#L10)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### meterId

> `readonly` **meterId**: `string`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:6](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L6)

***

### quota

> `readonly` **quota**: `number`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:8](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L8)

***

### tenantId

> `readonly` **tenantId**: `string`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:5](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L5)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:9](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/events-core/src/libs/DomainEvent.ts#L9)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)
