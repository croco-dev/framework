---
editUrl: false
next: false
prev: false
title: "InMemoryEventBus"
---

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:9](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L9)

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

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:119](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L119)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`clear`](/api/events-core/src/interfaces/eventbus/#clear)

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:13](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L13)

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

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:111](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L111)

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

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:115](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L115)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`unsubscribe`](/api/events-core/src/interfaces/eventbus/#unsubscribe)
