---
editUrl: false
next: false
prev: false
title: "InMemoryEventBus"
---

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:27](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L27)

`@croco/events-core`의 EventBus 인터페이스를 인메모리로 구현한 EventBus입니다.

## Implements

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)

## Constructors

### Constructor

> **new InMemoryEventBus**(): `InMemoryEventBus`

#### Returns

`InMemoryEventBus`

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:226](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L226)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`clear`](/api/events-core/src/interfaces/eventbus/#clear)

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:31](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L31)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`publish`](/api/events-core/src/interfaces/eventbus/#publish)

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:218](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L218)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`subscribe`](/api/events-core/src/interfaces/eventbus/#subscribe)

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:222](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L222)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`unsubscribe`](/api/events-core/src/interfaces/eventbus/#unsubscribe)
