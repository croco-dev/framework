---
editUrl: false
next: false
prev: false
title: "EntitlementOverageAllowedEvent"
---

entitlement 거부, quota 초과, overage 허용 시 발행되는 이벤트입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new EntitlementOverageAllowedEvent**(`tenantId`, `featureKey`, `usage`, `quota`, `planId`, `planVersionRef`): `EntitlementOverageAllowedEvent`

#### Parameters

##### tenantId

`string`

##### featureKey

`string`

##### usage

`number`

##### quota

`number`

##### planId

`string`

##### planVersionRef

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`EntitlementOverageAllowedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

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

### featureKey

> `readonly` **featureKey**: `string`

---

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

---

### planId

> `readonly` **planId**: `string`

---

### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

---

### quota

> `readonly` **quota**: `number`

---

### tenantId

> `readonly` **tenantId**: `string`

---

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

---

### usage

> `readonly` **usage**: `number`

---

### eventName

> `static` **eventName**: `string` = `"entitlement.overage.allowed"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
