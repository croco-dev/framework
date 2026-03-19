---
editUrl: false
next: false
prev: false
title: "EventBus"
---

Defined in: [packages/events-core/src/libs/EventBus.ts:11](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventBus.ts#L11)

이벤트 발행/구독 추상화와 구독 엔트리 타입입니다.

## Extends

- [`EventPublishing`](/api/events-core/src/interfaces/eventpublishing/).[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/)

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:10](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L10)

#### Returns

`void`

#### Inherited from

[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/).[`clear`](/api/events-core/src/interfaces/eventsubscribing/#clear)

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventPublishing.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventPublishing.ts#L8)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`EventPublishing`](/api/events-core/src/interfaces/eventpublishing/).[`publish`](/api/events-core/src/interfaces/eventpublishing/#publish)

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L8)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

#### Inherited from

[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/).[`subscribe`](/api/events-core/src/interfaces/eventsubscribing/#subscribe)

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L9)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

#### Inherited from

[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/).[`unsubscribe`](/api/events-core/src/interfaces/eventsubscribing/#unsubscribe)
