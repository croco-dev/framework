---
editUrl: false
next: false
prev: false
title: "AggregateRoot"
---

Defined in: [packages/events-core/src/libs/AggregateRoot.ts:3](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/AggregateRoot.ts#L3)

도메인 이벤트를 수집하고 발행할 수 있는 Aggregate Root 추상 클래스입니다.

## Constructors

### Constructor

> **new AggregateRoot**(): `AggregateRoot`

#### Returns

`AggregateRoot`

## Methods

### clearDomainEvents()

> **clearDomainEvents**(): `void`

Defined in: [packages/events-core/src/libs/AggregateRoot.ts:20](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/AggregateRoot.ts#L20)

#### Returns

`void`

***

### getDomainEvents()

> **getDomainEvents**(): readonly [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

Defined in: [packages/events-core/src/libs/AggregateRoot.ts:10](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/AggregateRoot.ts#L10)

#### Returns

readonly [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

***

### hasDomainEvents()

> **hasDomainEvents**(): `boolean`

Defined in: [packages/events-core/src/libs/AggregateRoot.ts:24](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/AggregateRoot.ts#L24)

#### Returns

`boolean`

***

### pullDomainEvents()

> **pullDomainEvents**(): readonly [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

Defined in: [packages/events-core/src/libs/AggregateRoot.ts:14](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/AggregateRoot.ts#L14)

#### Returns

readonly [`DomainEvent`](/api/events-core/src/classes/domainevent/)[]
