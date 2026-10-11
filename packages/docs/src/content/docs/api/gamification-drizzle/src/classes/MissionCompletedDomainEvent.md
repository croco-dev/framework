---
editUrl: false
next: false
prev: false
title: "MissionCompletedDomainEvent"
---

Logical completion only; consumers own their effects and delivery idempotency.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new MissionCompletedDomainEvent**(`key`, `completion`): `MissionCompletedDomainEvent`

#### Parameters

##### key

[`MissionAggregateKey`](/api/gamification-core/src/type-aliases/missionaggregatekey/)

##### completion

[`MissionCompletion`](/api/gamification-core/src/type-aliases/missioncompletion/)

#### Returns

`MissionCompletedDomainEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### completion

> `readonly` **completion**: [`MissionCompletion`](/api/gamification-core/src/type-aliases/missioncompletion/)

---

### eventId

> `readonly` **eventId**: `string`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventId`](/api/events-core/src/classes/domainevent/#eventid)

---

### eventName

> `readonly` **eventName**: `string`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

---

### key

> `readonly` **key**: [`MissionAggregateKey`](/api/gamification-core/src/type-aliases/missionaggregatekey/)

---

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

---

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

---

### eventName

> `readonly` `static` **eventName**: `"gamification.mission.completed"` = `"gamification.mission.completed"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)

## Methods

### fromPayload()

> `static` **fromPayload**(`payload`): `MissionCompletedDomainEvent`

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`MissionCompletedDomainEvent`
