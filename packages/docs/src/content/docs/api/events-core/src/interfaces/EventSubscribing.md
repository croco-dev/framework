---
editUrl: false
next: false
prev: false
title: "EventSubscribing"
---

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L7)

이벤트 구독 인터페이스입니다.
이벤트 버스에서 이벤트를 구독/해제하는 기능만 제공합니다.

## Extended by

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:10](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L10)

#### Returns

`void`

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L8)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L9)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`
