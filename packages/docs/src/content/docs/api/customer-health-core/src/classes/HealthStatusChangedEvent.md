---
editUrl: false
next: false
prev: false
title: "HealthStatusChangedEvent"
---

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new HealthStatusChangedEvent**(`tenantId`, `oldStatus`, `newStatus`, `score`): `HealthStatusChangedEvent`

#### Parameters

##### tenantId

`string`

##### oldStatus

[`HealthStatus`](/api/customer-health-core/src/type-aliases/healthstatus/)

##### newStatus

[`HealthStatus`](/api/customer-health-core/src/type-aliases/healthstatus/)

##### score

`number`

#### Returns

`HealthStatusChangedEvent`

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

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### newStatus

> `readonly` **newStatus**: [`HealthStatus`](/api/customer-health-core/src/type-aliases/healthstatus/)

***

### oldStatus

> `readonly` **oldStatus**: [`HealthStatus`](/api/customer-health-core/src/type-aliases/healthstatus/)

***

### score

> `readonly` **score**: `number`

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

> `static` **eventName**: `string` = `"health.status.changed"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
