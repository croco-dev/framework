---
editUrl: false
next: false
prev: false
title: "InMemoryEventBus"
---

TypeDI와 OpenTelemetry를 사용하는 인메모리 EventBus 구현체입니다.

## Type Parameters

### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Implements

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)\<`TEvent`\>

## Constructors

### Constructor

> **new InMemoryEventBus**\<`TEvent`\>(`options?`): `InMemoryEventBus`\<`TEvent`\>

#### Parameters

##### options?

[`InMemoryEventBusOptions`](/api/events-inmemory/src/type-aliases/inmemoryeventbusoptions/) = `{}`

#### Returns

`InMemoryEventBus`\<`TEvent`\>

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`clear`](/api/events-core/src/interfaces/eventbus/#clear)

---

### getRunningHandlerCount()

> **getRunningHandlerCount**(): `number`

#### Returns

`number`

---

### getRunningHandlers()

> **getRunningHandlers**(): readonly `RunningHandler`[]

#### Returns

readonly `RunningHandler`[]

---

### publish()

> **publish**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

`TEvent`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`publish`](/api/events-core/src/interfaces/eventbus/#publish)

---

### replayDeadLetters()

> **replayDeadLetters**(`limit?`): `Promise`\<[`DeadLetterReplayResult`](/api/events-inmemory/src/type-aliases/deadletterreplayresult/)\>

Removes a batch and re-executes only its failed handlers.
Failed writes return the unpersisted item and storage error to the caller for recovery.

#### Parameters

##### limit?

`number`

#### Returns

`Promise`\<[`DeadLetterReplayResult`](/api/events-inmemory/src/type-aliases/deadletterreplayresult/)\>

---

### subscribe()

> **subscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`subscribe`](/api/events-core/src/interfaces/eventbus/#subscribe)

---

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>

#### Returns

`void`

#### Implementation of

[`EventBus`](/api/events-core/src/interfaces/eventbus/).[`unsubscribe`](/api/events-core/src/interfaces/eventbus/#unsubscribe)
