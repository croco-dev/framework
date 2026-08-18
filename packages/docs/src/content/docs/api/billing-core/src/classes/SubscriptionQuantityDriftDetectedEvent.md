---
editUrl: false
next: false
prev: false
title: "SubscriptionQuantityDriftDetectedEvent"
---

Signals that the provider quantity differs from the desired application-owned quantity.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new SubscriptionQuantityDriftDetectedEvent**(`tenantId`, `externalSubscriptionId`, `desiredQuantity`, `providerQuantity`, `planVersionRef`): `SubscriptionQuantityDriftDetectedEvent`

#### Parameters

##### tenantId

`string`

##### externalSubscriptionId

`string`

##### desiredQuantity

`number`

##### providerQuantity

`number`

##### planVersionRef

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`SubscriptionQuantityDriftDetectedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### desiredQuantity

> `readonly` **desiredQuantity**: `number`

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

### externalSubscriptionId

> `readonly` **externalSubscriptionId**: `string`

---

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

---

### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

---

### providerQuantity

> `readonly` **providerQuantity**: `number`

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

> `readonly` `static` **eventName**: `"billing.subscription_quantity.drift_detected"` = `"billing.subscription_quantity.drift_detected"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
