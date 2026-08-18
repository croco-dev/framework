---
editUrl: false
next: false
prev: false
title: "OrderPaidEvent"
---

결제 완료 시 발행되는 도메인 이벤트입니다.

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new OrderPaidEvent**(`tenantId`, `externalOrderId`, `amount`, `currency`, `reason`): `OrderPaidEvent`

#### Parameters

##### tenantId

`string`

##### externalOrderId

`string`

##### amount

`number`

##### currency

`string`

##### reason

[`OrderPaymentReason`](/api/billing-core/src/type-aliases/orderpaymentreason/)

#### Returns

`OrderPaidEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### amount

> `readonly` **amount**: `number`

---

### currency

> `readonly` **currency**: `string`

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

### externalOrderId

> `readonly` **externalOrderId**: `string`

---

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

---

### reason

> `readonly` **reason**: [`OrderPaymentReason`](/api/billing-core/src/type-aliases/orderpaymentreason/)

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

> `readonly` `static` **eventName**: `"billing.order_paid"` = `"billing.order_paid"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
