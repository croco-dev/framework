---
editUrl: false
next: false
prev: false
title: "PolarEventMapper"
---

Maps Polar webhook events to internal domain events.

## Constructors

### Constructor

> **new PolarEventMapper**(): `PolarEventMapper`

#### Returns

`PolarEventMapper`

## Methods

### mapOrderEvent()

> **mapOrderEvent**(`eventType`, `tenantId`, `order`): [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

Map a Polar order event to internal domain events.

#### Parameters

##### eventType

`string`

##### tenantId

`string`

##### order

###### amount

`number`

###### currency

`string`

###### id

`string`

#### Returns

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

***

### mapSubscriptionEvent()

> **mapSubscriptionEvent**(`eventType`, `tenantId`, `subscription`, `previousPlanId?`): [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

Map a Polar subscription event to internal domain events.
Returns array because one webhook can produce multiple internal events.

#### Parameters

##### eventType

`string`

##### tenantId

`string`

##### subscription

###### cancelAtPeriodEnd?

`boolean`

###### id

`string`

###### productId

`string`

###### status

`string`

##### previousPlanId?

`string`

#### Returns

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]
