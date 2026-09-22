---
editUrl: false
next: false
prev: false
title: "AiCostBudgetExceededEvent"
---

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new AiCostBudgetExceededEvent**(`tenantId`, `currentCost`, `limit`, `period`): `AiCostBudgetExceededEvent`

#### Parameters

##### tenantId

`string`

##### currentCost

`number`

##### limit

`number`

##### period

`"daily"` \| `"monthly"`

#### Returns

`AiCostBudgetExceededEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### currentCost

> `readonly` **currentCost**: `number`

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

### limit

> `readonly` **limit**: `number`

---

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

---

### period

> `readonly` **period**: `"daily"` \| `"monthly"`

---

### tenantId

> `readonly` **tenantId**: `string`

---

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

---

### eventName

> `static` **eventName**: `string` = `"ai-usage/cost-budget-exceeded"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
