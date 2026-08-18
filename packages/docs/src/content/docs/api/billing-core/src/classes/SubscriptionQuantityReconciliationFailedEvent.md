---
editUrl: false
next: false
prev: false
title: "SubscriptionQuantityReconciliationFailedEvent"
---

Carries stable Problem evidence for a failed licensed-quantity reconciliation.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new SubscriptionQuantityReconciliationFailedEvent**(`tenantId`, `externalSubscriptionId`, `desiredQuantity`, `problemCode`, `retryable`, `planVersionRef`): `SubscriptionQuantityReconciliationFailedEvent`

#### Parameters

##### tenantId

`string`

##### externalSubscriptionId

`string`

##### desiredQuantity

`number`

##### problemCode

`string`

##### retryable

`boolean`

##### planVersionRef

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`SubscriptionQuantityReconciliationFailedEvent`

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

### problemCode

> `readonly` **problemCode**: `string`

---

### retryable

> `readonly` **retryable**: `boolean`

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

> `readonly` `static` **eventName**: `"billing.subscription_quantity.reconciliation_failed"` = `"billing.subscription_quantity.reconciliation_failed"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
