---
editUrl: false
next: false
prev: false
title: "SubscriptionRevokedEvent"
---

구독 회수 또는 강제 종료 시 발행되는 도메인 이벤트입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new SubscriptionRevokedEvent**(`tenantId`, `externalSubscriptionId`): `SubscriptionRevokedEvent`

#### Parameters

##### tenantId

`string`

##### externalSubscriptionId

`string`

#### Returns

`SubscriptionRevokedEvent`

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

### externalSubscriptionId

> `readonly` **externalSubscriptionId**: `string`

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

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

> `readonly` `static` **eventName**: `"billing.subscription_revoked"` = `"billing.subscription_revoked"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
