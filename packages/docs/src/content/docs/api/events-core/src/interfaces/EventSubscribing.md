---
editUrl: false
next: false
prev: false
title: "EventSubscribing"
---

이벤트 구독 인터페이스입니다.
이벤트 버스에서 이벤트를 구독/해제하는 기능만 제공합니다.

## Extended by

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)

## Type Parameters

### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

---

### subscribe()

> **subscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

---

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`
