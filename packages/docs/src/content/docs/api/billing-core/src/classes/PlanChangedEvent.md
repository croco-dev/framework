---
editUrl: false
next: false
prev: false
title: "PlanChangedEvent"
---

플랜 변경 시 발행되는 도메인 이벤트입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new PlanChangedEvent**(`tenantId`, `previousPlanId`, `newPlanId`, `externalSubscriptionId`): `PlanChangedEvent`

#### Parameters

##### tenantId

`string`

##### previousPlanId

`string`

##### newPlanId

`string`

##### externalSubscriptionId

`string`

#### Returns

`PlanChangedEvent`

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

### newPlanId

> `readonly` **newPlanId**: `string`

***

### previousPlanId

> `readonly` **previousPlanId**: `string`

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

> `readonly` `static` **eventName**: `"billing.plan_changed"` = `"billing.plan_changed"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
