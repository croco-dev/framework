---
editUrl: false
next: false
prev: false
title: "EventBusConfig"
---

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:12](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L12)

전역 EventBus 설정과 핸들러 등록 초기화를 관리합니다.

## Constructors

### Constructor

> **new EventBusConfig**(): `EventBusConfig`

#### Returns

`EventBusConfig`

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:61](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L61)

#### Returns

`void`

***

### getEventBus()

> **getEventBus**(): [`EventBus`](/api/events-core/src/interfaces/eventbus/)

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:29](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L29)

#### Returns

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

***

### setEventBus()

> **setEventBus**(`eventBus`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:36](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L36)

#### Parameters

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

`void`

***

### start()

> **start**(`options`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:67](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L67)

#### Parameters

##### options

`EventBusStartOptions`

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:41](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L41)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:45](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L45)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### getInstance()

> `static` **getInstance**(): `EventBusConfig`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:18](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L18)

#### Returns

`EventBusConfig`

***

### setInstance()

> `static` **setInstance**(`config`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventBusConfig.ts#L25)

#### Parameters

##### config

`EventBusConfig`

#### Returns

`void`
