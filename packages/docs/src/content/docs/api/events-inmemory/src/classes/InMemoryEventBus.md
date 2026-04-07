---
editUrl: false
next: false
prev: false
title: "InMemoryEventBus"
---

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:40](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L40)

`@croco/events-core`의 EventBus 인터페이스를 인메모리로 구현한 EventBus입니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Implements

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)\<`TEvent`\>

## Constructors

### Constructor

> **new InMemoryEventBus**\<`TEvent`\>(`options?`): `InMemoryEventBus`\<`TEvent`\>

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:48](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L48)

#### Parameters

##### options?

[`InMemoryEventBusOptions`](/api/events-inmemory/src/type-aliases/inmemoryeventbusoptions/) = `{}`

#### Returns

`InMemoryEventBus`\<`TEvent`\>

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:339](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L339)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`clear`](/api/events-core/src/interfaces/eventbus/#clear)

***

### getRunningHandlerCount()

> **getRunningHandlerCount**(): `number`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:345](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L345)

#### Returns

`number`

***

### getRunningHandlers()

> **getRunningHandlers**(): readonly `RunningHandler`[]

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:349](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L349)

#### Returns

readonly `RunningHandler`[]

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:53](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L53)

#### Parameters

##### event

`TEvent`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`publish`](/api/events-core/src/interfaces/eventbus/#publish)

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:322](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L322)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`subscribe`](/api/events-core/src/interfaces/eventbus/#subscribe)

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:326](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L326)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`unsubscribe`](/api/events-core/src/interfaces/eventbus/#unsubscribe)
