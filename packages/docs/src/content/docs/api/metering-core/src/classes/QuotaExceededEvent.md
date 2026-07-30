---
editUrl: false
next: false
prev: false
title: "QuotaExceededEvent"
---

quota 초과 시 발행되는 도메인 이벤트입니다.

## Description

테넌트의 사용량이 설정된 quota를 초과했을 때 발행되는 이벤트입니다.

## Example

```typescript
eventBus.publish(
  new QuotaExceededEvent(
    "tenant-123",
    "api_calls",
    10000,
    10000,
    "request-123",
    "operation-123",
  ),
);
```

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new QuotaExceededEvent**(`tenantId`, `meterId`, `currentUsage`, `quota`, `idempotencyKey?`, `operationId?`): `QuotaExceededEvent`

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### currentUsage

`number`

##### quota

`number`

##### idempotencyKey?

`string`

##### operationId?

`string`

#### Returns

`QuotaExceededEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### currentUsage

> `readonly` **currentUsage**: `number`

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

### meterId

> `readonly` **meterId**: `string`

***

### quota

> `readonly` **quota**: `number`

***

### tenantId

> `readonly` **tenantId**: `string`

***

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### eventName

> `static` **eventName**: `string` = `"metering.quota_exceeded"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
