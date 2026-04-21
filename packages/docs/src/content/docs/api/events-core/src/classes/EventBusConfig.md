---
editUrl: false
next: false
prev: false
title: "EventBusConfig"
---

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:15](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L15)

전역 EventBus 인스턴스와 핸들러 구독 등록을 관리하는 설정 객체입니다.

## Constructors

### Constructor

> **new EventBusConfig**(): `EventBusConfig`

#### Returns

`EventBusConfig`

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:64](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L64)

#### Returns

`void`

***

### getEventBus()

> **getEventBus**(): [`EventBus`](/api/events-core/src/interfaces/eventbus/)

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:32](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L32)

#### Returns

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

***

### setEventBus()

> **setEventBus**(`eventBus`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:39](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L39)

#### Parameters

##### eventBus

[`EventBus`](/api/events-core/src/interfaces/eventbus/)

#### Returns

`void`

***

### start()

> **start**(`options`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:70](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L70)

#### Parameters

##### options

`EventBusStartOptions`

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:44](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L44)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### unsubscribe()

> **unsubscribe**(`subscription`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:48](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L48)

#### Parameters

##### subscription

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)

#### Returns

`void`

***

### getInstance()

> `static` **getInstance**(): `EventBusConfig`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:21](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L21)

#### Returns

`EventBusConfig`

***

### setInstance()

> `static` **setInstance**(`config`): `void`

Defined in: [packages/events-core/src/libs/EventBusConfig.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBusConfig.ts#L28)

#### Parameters

##### config

`EventBusConfig`

#### Returns

`void`
