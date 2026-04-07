---
editUrl: false
next: false
prev: false
title: "EventBus"
---

Defined in: [packages/events-core/src/libs/EventBus.ts:12](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBus.ts#L12)

이벤트 발행/구독 추상화와 구독 엔트리 타입입니다.

## Extends

- [`EventPublishing`](/api/events-core/src/interfaces/eventpublishing/)\<`TEvent`\>.[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/)\<`TEvent`\>

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:11](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L11)

#### Returns

`void`

#### Inherited from

[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/).[`clear`](/api/events-core/src/interfaces/eventsubscribing/#clear)

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventPublishing.ts:8](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventPublishing.ts#L8)

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

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L9)

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

Defined in: [packages/events-core/src/libs/interfaces/EventSubscribing.ts:10](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventSubscribing.ts#L10)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

#### Inherited from

[`EventSubscribing`](/api/events-core/src/interfaces/eventsubscribing/).[`unsubscribe`](/api/events-core/src/interfaces/eventsubscribing/#unsubscribe)
