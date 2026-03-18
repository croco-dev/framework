---
editUrl: false
next: false
prev: false
title: "QuotaExceededEvent"
---

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:3](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L3)

quota 초과 시 발행되는 도메인 이벤트입니다.

## Description

테넌트의 사용량이 설정된 quota를 초과했을 때 발행되는 이벤트입니다.

## Example

```typescript
eventBus.publish(new QuotaExceededEvent({
  tenantId: 'tenant-123',
  meterId: 'api_calls',
  currentUsage: 10000,
  quota: 10000,
  timestamp: new Date(),
}));
```

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new QuotaExceededEvent**(`tenantId`, `meterId`, `currentUsage`, `quota`): `QuotaExceededEvent`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:6](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L6)

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

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L9)

***

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

### meterId

> `readonly` **meterId**: `string`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L8)

***

### quota

> `readonly` **quota**: `number`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:10](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L10)

***

### tenantId

> `readonly` **tenantId**: `string`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L7)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:19](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/DomainEvent.ts#L19)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### eventName

> `static` **eventName**: `string` = `'metering.quota_exceeded'`

Defined in: [packages/metering-core/src/libs/events/QuotaExceededEvent.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/events/QuotaExceededEvent.ts#L4)

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
