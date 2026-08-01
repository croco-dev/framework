---
editUrl: false
next: false
prev: false
title: "PlanReleaseTransitionedEvent"
---

Records one durable, revision-addressed plan release lifecycle transition.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new PlanReleaseTransitionedEvent**(`input`): `PlanReleaseTransitionedEvent`

#### Parameters

##### input

###### actorId

`string`

###### eventId?

`string`

###### from

[`PlanReleaseState`](/api/billing-core/src/type-aliases/planreleasestate/) \| `null`

###### planVersionRef

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

###### reason

`string`

###### revision

`number`

###### to

[`PlanReleaseState`](/api/billing-core/src/type-aliases/planreleasestate/)

#### Returns

`PlanReleaseTransitionedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### actorId

> `readonly` **actorId**: `string`

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

### from

> `readonly` **from**: [`PlanReleaseState`](/api/billing-core/src/type-aliases/planreleasestate/) \| `null`

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

***

### reason

> `readonly` **reason**: `string`

***

### revision

> `readonly` **revision**: `number`

***

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### to

> `readonly` **to**: [`PlanReleaseState`](/api/billing-core/src/type-aliases/planreleasestate/)

***

### eventName

> `readonly` `static` **eventName**: `"billing.plan_release.transitioned"` = `"billing.plan_release.transitioned"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
