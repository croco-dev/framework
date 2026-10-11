---
editUrl: false
next: false
prev: false
title: "GoalAchievedDomainEvent"
---

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new GoalAchievedDomainEvent**(`intent`): `GoalAchievedDomainEvent`

#### Parameters

##### intent

[`GoalAchievedEventIntent`](/api/onboarding-core/src/type-aliases/goalachievedeventintent/)

#### Returns

`GoalAchievedDomainEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### achievedAt

> `readonly` **achievedAt**: `Date`

---

### definitionId

> `readonly` **definitionId**: `string`

---

### definitionVersion

> `readonly` **definitionVersion**: `string`

---

### episodeId

> `readonly` **episodeId**: `string`

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

### id

> `readonly` **id**: `string`

---

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

---

### scope

> `readonly` **scope**: [`GoalScope`](/api/onboarding-core/src/type-aliases/goalscope/)

---

### subject

> `readonly` **subject**: [`GoalSubject`](/api/onboarding-core/src/type-aliases/goalsubject/)

---

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

---

### eventName

> `readonly` `static` **eventName**: `"onboarding.goal.achieved"` = `"onboarding.goal.achieved"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)

## Methods

### fromPayload()

> `static` **fromPayload**(`payload`): `GoalAchievedDomainEvent`

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`GoalAchievedDomainEvent`
