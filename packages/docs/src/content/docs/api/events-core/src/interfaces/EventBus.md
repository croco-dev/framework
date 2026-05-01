---
editUrl: false
next: false
prev: false
title: "EventBus"
---

이벤트 발행/구독 추상화와 구독 엔트리 타입입니다.

## Extends

- [`EventPublishing`](/api/events-core/src/interfaces/eventpublishing/)\<`TEvent`\>.[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/)\<`TEvent`\>

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

#### Inherited from

[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/).[`clear`](/api/events-core/src/interfaces/eventsubscribing/#clear)

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

`TEvent`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`EventPublishing`](/api/events-core/src/interfaces/eventpublishing/).[`publish`](/api/events-core/src/interfaces/eventpublishing/#publish)

***

### subscribe()

> **subscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

#### Inherited from

[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/).[`subscribe`](/api/events-core/src/interfaces/eventsubscribing/#subscribe)

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

#### Inherited from

[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/).[`unsubscribe`](/api/events-core/src/interfaces/eventsubscribing/#unsubscribe)
