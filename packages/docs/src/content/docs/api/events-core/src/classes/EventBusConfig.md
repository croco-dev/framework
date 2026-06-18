---
editUrl: false
next: false
prev: false
title: "EventBusConfig"
---

전역 EventBus 인스턴스와 핸들러 구독 등록을 관리하는 설정 객체입니다.

## Constructors

### Constructor

> **new EventBusConfig**(): `EventBusConfig`

#### Returns

`EventBusConfig`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

***

### getEventBus()

> **getEventBus**(): [`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

***

### getSubscriptions()

> **getSubscriptions**(): `ReadonlySet`\<[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>\>

#### Returns

`ReadonlySet`\<[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>\>

***

### setEventBus()

> **setEventBus**(`eventBus`): `void`

#### Parameters

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

`void`

***

### start()

> **start**(`options`): `Promise`\<`void`\>

#### Parameters

##### options

`EventBusStartOptions`

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### getInstance()

> `static` **getInstance**(): `EventBusConfig`

#### Returns

`EventBusConfig`

***

### getStats()

> `static` **getStats**(): [`EventBusStats`](/api/events-core/src/classes/eventbusstats/) \| `undefined`

#### Returns

[`EventBusStats`](/api/events-core/src/classes/eventbusstats/) \| `undefined`

***

### setInstance()

> `static` **setInstance**(`config`): `void`

#### Parameters

##### config

`EventBusConfig`

#### Returns

`void`

***

### setStats()

> `static` **setStats**(`stats`): `void`

#### Parameters

##### stats

[`EventBusStats`](/api/events-core/src/classes/eventbusstats/)

#### Returns

`void`
