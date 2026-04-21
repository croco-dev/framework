---
editUrl: false
next: false
prev: false
title: "InMemoryEventBus"
---

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:58](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L58)

TypeDI와 OpenTelemetry를 사용하는 인메모리 EventBus 구현체입니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Implements

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)\<`TEvent`\>

## Constructors

### Constructor

> **new InMemoryEventBus**\<`TEvent`\>(`options?`): `InMemoryEventBus`\<`TEvent`\>

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:66](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L66)

#### Parameters

##### options?

[`InMemoryEventBusOptions`](/api/events-inmemory/src/type-aliases/inmemoryeventbusoptions/) = `{}`

#### Returns

`InMemoryEventBus`\<`TEvent`\>

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:363](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L363)

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`clear`](/api/events-core/src/interfaces/eventbus/#clear)

***

### getRunningHandlerCount()

> **getRunningHandlerCount**(): `number`

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:369](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L369)

#### Returns

`number`

***

### getRunningHandlers()

> **getRunningHandlers**(): readonly `RunningHandler`[]

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:373](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L373)

#### Returns

readonly `RunningHandler`[]

***

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:77](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L77)

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

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:346](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L346)

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

Defined in: [packages/events-inmemory/src/libs/InmemoryEventBus.ts:350](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-inmemory/src/libs/InmemoryEventBus.ts#L350)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`unsubscribe`](/api/events-core/src/interfaces/eventbus/#unsubscribe)
