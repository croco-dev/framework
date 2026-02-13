---
editUrl: false
next: false
prev: false
title: "InMemoryEventBus"
---

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:7](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L7)

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

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:106](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L106)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`clear`](/api/events-core/src/interfaces/eventbus/#clear)

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:11](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L11)

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

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:87](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L87)

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

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:99](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L99)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`unsubscribe`](/api/events-core/src/interfaces/eventbus/#unsubscribe)
