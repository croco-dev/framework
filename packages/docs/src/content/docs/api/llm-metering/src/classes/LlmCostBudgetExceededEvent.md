---
editUrl: false
next: false
prev: false
title: "LlmCostBudgetExceededEvent"
---

비용 예산 초과 시 발행되는 이벤트입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new LlmCostBudgetExceededEvent**(`tenantId`, `currentCost`, `limit`, `period`): `LlmCostBudgetExceededEvent`

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

`LlmCostBudgetExceededEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### currentCost

> `readonly` **currentCost**: `number`

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

### limit

> `readonly` **limit**: `number`

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### period

> `readonly` **period**: `"daily"` \| `"monthly"`

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

> `static` **eventName**: `string` = `"llm.cost_budget_exceeded"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
