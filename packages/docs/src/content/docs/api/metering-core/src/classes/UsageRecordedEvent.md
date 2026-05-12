---
editUrl: false
next: false
prev: false
title: "UsageRecordedEvent"
---

사용량 기록 시 발행되는 도메인 이벤트입니다.

## Description

사용량이 성공적으로 기록되었을 때 발행되는 이벤트입니다.

## Example

```typescript
eventBus.publish(new UsageRecordedEvent({
  tenantId: 'tenant-123',
  meterId: 'api_calls',
  value: 1,
  recordedAt: new Date(),
  metadata: { endpoint: '/api/users' },
}));
```

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new UsageRecordedEvent**(`tenantId`, `meterId`, `value`, `idempotencyKey`, `metadata?`): `UsageRecordedEvent`

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

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### meterId

> `readonly` **meterId**: `string`

***

### tenantId

> `readonly` **tenantId**: `string`

***

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### value

> `readonly` **value**: `number`

***

### eventName

> `static` **eventName**: `string` = `'metering.usage_recorded'`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
