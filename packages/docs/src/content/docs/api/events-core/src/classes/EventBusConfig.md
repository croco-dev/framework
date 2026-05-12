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

---

### getEventBus()

> **getEventBus**(): [`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

---

### setEventBus()

> **setEventBus**(`eventBus`): `void`

#### Parameters

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

`void`

---

### start()

> **start**(`options`): `Promise`\<`void`\>

#### Parameters

##### options

`EventBusStartOptions`

#### Returns

`Promise`\<`void`\>

---

### subscribe()

> **subscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

---

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

---

### getInstance()

> `static` **getInstance**(): `EventBusConfig`

#### Returns

`EventBusConfig`

---

### setInstance()

> `static` **setInstance**(`config`): `void`

#### Parameters

##### config

`EventBusConfig`

#### Returns

`void`
