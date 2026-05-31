---
editUrl: false
next: false
prev: false
title: "AggregateRoot"
---

도메인 이벤트를 수집하고 발행할 수 있는 Aggregate Root 추상 클래스입니다.

## Constructors

### Constructor

> **new AggregateRoot**(): `AggregateRoot`

#### Returns

`AggregateRoot`

## Methods

### clearDomainEvents()

> **clearDomainEvents**(): `void`

#### Returns

`void`

---

### getDomainEvents()

> **getDomainEvents**(): readonly [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

readonly [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

---

### hasDomainEvents()

> **hasDomainEvents**(): `boolean`

#### Returns

`boolean`

---

### pullDomainEvents()

> **pullDomainEvents**(): readonly [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

readonly [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]
