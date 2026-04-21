---
editUrl: false
next: false
prev: false
title: "EventSubscribing"
---

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L8)

이벤트 구독 인터페이스입니다.
이벤트 버스에서 이벤트를 구독/해제하는 기능만 제공합니다.

## Extended by

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:11](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L11)

#### Returns

`void`

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L9)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L10)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`
